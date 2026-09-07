/**
 * Daily hosting payment check.
 *
 * 1) Ask Stripe (and local invoices) whether each platform host is paid.
 * 2) Confirm paid hosts (ACTIVE, clear dunning).
 * 3) Mark unpaid hosts PAST_DUE, then 3-day grace / day-5 reminder + pause.
 *
 * Must run once per UTC day. In-process cron gates on CronRun; GitHub Actions
 * and GET /api/cron/hosting-payments are backups.
 */

import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { applyHostingSubscriptionFromStripe } from "@/lib/platform-billing";
import { markHostingInvoicePaidByStripeId } from "@/lib/hosting-billing";
import {
  markHostingPastDue,
  processHostingDunning,
} from "@/lib/hosting-dunning";

export const DAILY_HOSTING_PAYMENTS_JOB = "daily_hosting_payments";

export type HostingPaymentCheckResult = {
  skipped: boolean;
  ranAt: string;
  checked: number;
  confirmedPaid: number;
  markedPastDue: number;
  reminded: number;
  paused: number;
  errors: string[];
};

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function stripeId(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id || null;
}

export async function lastDailyHostingPaymentCheck(): Promise<{
  lastFinishedAt: Date | null;
  lastOk: boolean;
  lastSummary: string | null;
} | null> {
  const row = await prisma.cronRun.findUnique({
    where: { name: DAILY_HOSTING_PAYMENTS_JOB },
  });
  if (!row) return null;
  return {
    lastFinishedAt: row.lastFinishedAt,
    lastOk: row.lastOk,
    lastSummary: row.lastSummary,
  };
}

/** Run today if we have not already succeeded on this UTC day. */
export async function maybeRunDailyHostingPaymentCheck(
  now = new Date(),
): Promise<HostingPaymentCheckResult> {
  const existing = await prisma.cronRun.findUnique({
    where: { name: DAILY_HOSTING_PAYMENTS_JOB },
  });
  if (
    existing?.lastOk &&
    existing.lastFinishedAt &&
    utcDay(existing.lastFinishedAt) === utcDay(now)
  ) {
    return {
      skipped: true,
      ranAt: now.toISOString(),
      checked: 0,
      confirmedPaid: 0,
      markedPastDue: 0,
      reminded: 0,
      paused: 0,
      errors: [],
    };
  }
  return runDailyHostingPaymentCheck(now);
}

export async function runDailyHostingPaymentCheck(
  now = new Date(),
): Promise<HostingPaymentCheckResult> {
  await prisma.cronRun.upsert({
    where: { name: DAILY_HOSTING_PAYMENTS_JOB },
    create: {
      name: DAILY_HOSTING_PAYMENTS_JOB,
      lastStartedAt: now,
      lastOk: false,
    },
    update: { lastStartedAt: now, lastOk: false },
  });

  const result: HostingPaymentCheckResult = {
    skipped: false,
    ranAt: now.toISOString(),
    checked: 0,
    confirmedPaid: 0,
    markedPastDue: 0,
    reminded: 0,
    paused: 0,
    errors: [],
  };

  try {
    const recon = await reconcileHostingPayments(now);
    result.checked = recon.checked;
    result.confirmedPaid = recon.confirmedPaid;
    result.markedPastDue = recon.markedPastDue;
    result.errors.push(...recon.errors);

    const dunning = await processHostingDunning(now);
    result.reminded = dunning.reminded;
    result.paused = dunning.paused;

    const summary = JSON.stringify({
      checked: result.checked,
      confirmedPaid: result.confirmedPaid,
      markedPastDue: result.markedPastDue,
      reminded: result.reminded,
      paused: result.paused,
      errors: result.errors.length,
    });
    await prisma.cronRun.update({
      where: { name: DAILY_HOSTING_PAYMENTS_JOB },
      data: {
        lastFinishedAt: new Date(),
        lastOk: result.errors.length === 0,
        lastSummary: summary,
      },
    });
    console.info("[cron:hosting-payments]", summary);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    result.errors.push(message);
    await prisma.cronRun.update({
      where: { name: DAILY_HOSTING_PAYMENTS_JOB },
      data: {
        lastFinishedAt: new Date(),
        lastOk: false,
        lastSummary: message.slice(0, 500),
      },
    });
    console.error("[cron:hosting-payments] failed", e);
  }

  return result;
}

async function reconcileHostingPayments(now: Date): Promise<{
  checked: number;
  confirmedPaid: number;
  markedPastDue: number;
  errors: string[];
}> {
  const stripe = isStripeConfigured() ? getStripe() : null;
  const hosts = await prisma.host.findMany({
    where: {
      hostingMode: "PLATFORM",
      approvalStatus: "APPROVED",
      OR: [
        {
          subscriptionStatus: {
            in: ["ACTIVE", "PAST_DUE", "PAUSED", "PENDING_PAYMENT"],
          },
        },
        { stripeSubscriptionId: { not: null } },
        { stripeCustomerId: { not: null } },
      ],
    },
    include: {
      plan: { select: { monthlyPrice: true } },
      invoices: {
        where: { status: { in: ["OPEN", "DRAFT"] } },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  let confirmedPaid = 0;
  let markedPastDue = 0;
  const errors: string[] = [];

  for (const host of hosts) {
    if ((host.plan?.monthlyPrice ?? 0) <= 0) continue;

    try {
      let paid = false;
      let unpaid = false;

      if (stripe && host.stripeSubscriptionId) {
        const sub = await stripe.subscriptions.retrieve(host.stripeSubscriptionId);
        const status = sub.status;
        await applyHostingSubscriptionFromStripe({
          hostId: host.id,
          customerId: stripeId(sub.customer),
          subscriptionId: sub.id,
          stripeStatus: status,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        });
        if (status === "active" || status === "trialing") paid = true;
        if (status === "past_due" || status === "unpaid") unpaid = true;
      }

      if (stripe && host.stripeCustomerId && !paid) {
        const open = await stripe.invoices.list({
          customer: host.stripeCustomerId,
          status: "open",
          limit: 5,
        });
        for (const inv of open.data) {
          if (inv.id) {
            const local = await prisma.hostingInvoice.findFirst({
              where: { stripeInvoiceId: inv.id },
            });
            if (local && inv.status === "paid") {
              await markHostingInvoicePaidByStripeId(inv.id);
            }
          }
          const due = inv.due_date
            ? new Date(inv.due_date * 1000)
            : inv.created
              ? new Date(inv.created * 1000)
              : null;
          if (!due || due.getTime() <= now.getTime()) unpaid = true;
        }
      }

      for (const inv of host.invoices) {
        if (stripe && inv.stripeInvoiceId) {
          const remote = await stripe.invoices.retrieve(inv.stripeInvoiceId);
          if (remote.status === "paid") {
            await markHostingInvoicePaidByStripeId(inv.stripeInvoiceId);
            paid = true;
            continue;
          }
          if (remote.status === "open" || remote.status === "uncollectible") {
            unpaid = true;
          }
        } else if (inv.dueDate && inv.dueDate.getTime() <= now.getTime()) {
          unpaid = true;
        }
      }

      if (paid) {
        confirmedPaid += 1;
      } else if (unpaid) {
        await markHostingPastDue(host.id);
        markedPastDue += 1;
      }
    } catch (e) {
      errors.push(
        `${host.slug}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return {
    checked: hosts.length,
    confirmedPaid,
    markedPastDue,
    errors,
  };
}
