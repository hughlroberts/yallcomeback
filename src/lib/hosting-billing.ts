import { prisma } from "@/lib/db";
import { addMonths, calculateHostingAmount } from "@/lib/hosting";
import {
  hostHasPricingIntelligenceAddon,
  PRICING_INTELLIGENCE_ADDON_LABEL,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import {
  CARD_PROCESSING_LINE,
  getStripe,
  isStripeConfigured,
  processingFeeToNetCents,
  toStripeAmount,
} from "@/lib/stripe";
import {
  customerHasCardOnFile,
  ensurePlatformCustomer,
  stripeObjectId,
} from "@/lib/platform-billing";
import type { HostingInvoiceStatus } from "@prisma/client";

export async function createHostingInvoiceForHost(opts: {
  hostId: string;
  planId?: string | null;
  notes?: string | null;
  /** If true, try Stripe send_invoice when configured */
  sendStripe?: boolean;
}) {
  const host = await prisma.host.findUnique({
    where: { id: opts.hostId },
    include: { plan: true, users: { where: { role: "HOST" }, take: 1 } },
  });
  if (!host) throw new Error("Host not found");

  const planId = opts.planId || host.planId;
  if (!planId) throw new Error("Assign a hosting plan first");

  const plan = await prisma.hostingPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw new Error("Invalid hosting plan");

  const publishedCount = await prisma.property.count({
    where: { hostId: host.id, published: true },
  });
  const { amount: hostingAmount, propertyCount, unitPrice } =
    calculateHostingAmount(plan, publishedCount);

  // Pricing intelligence is a separate $35/mo line — never folded into plan price
  const addonActive = hostHasPricingIntelligenceAddon(host);
  const addonAmount = addonActive
    ? host.pricingIntelligenceAddonAmount || PRICING_INTELLIGENCE_ADDON_USD
    : 0;
  const amount = hostingAmount + addonAmount;

  const periodStart = host.currentPeriodEnd
    ? new Date(host.currentPeriodEnd)
    : new Date();
  const periodEnd = addMonths(periodStart, 1);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const billingEmail =
    host.billingEmail ||
    host.contactEmail ||
    host.users[0]?.email ||
    null;

  const hostingLine =
    plan.pricingModel === "PER_PROPERTY"
      ? `${plan.name} - ${propertyCount} propert${propertyCount === 1 ? "y" : "ies"} × $${unitPrice}/mo (${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)})`
      : `${plan.name} - website hosting (${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)})`;
  const addonLine = addonActive
    ? ` + ${PRICING_INTELLIGENCE_ADDON_LABEL} $${addonAmount}/mo add-on`
    : "";
  const lineDescription = `${hostingLine}${addonLine}`;

  // Complimentary / $0 plans: keep host as a customer; still charge add-on if active
  if (amount <= 0) {
    const record = await prisma.hostingInvoice.create({
      data: {
        hostId: host.id,
        planId: plan.id,
        amount: 0,
        currency: plan.currency,
        pricingModel: plan.pricingModel,
        unitPrice: 0,
        propertyCount,
        periodStart,
        periodEnd,
        status: "PAID",
        dueDate,
        paidAt: new Date(),
        notes:
          opts.notes ||
          `Complimentary hosting · no charge · ${lineDescription}`,
      },
    });
    await prisma.host.update({
      where: { id: host.id },
      data: {
        planId: plan.id,
        subscriptionStatus: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        billingEmail: billingEmail || host.billingEmail,
      },
    });
    return record;
  }

  let stripeInvoiceId: string | null = null;
  let stripeHostedInvoiceUrl: string | null = null;
  let status: "OPEN" | "DRAFT" | "PAID" = "OPEN";
  let chargedCardOnFile = false;

  const stripe = opts.sendStripe !== false ? getStripe() : null;

  if (stripe && billingEmail) {
    const customerId = await ensurePlatformCustomer({
      id: host.id,
      name: host.name,
      slug: host.slug,
      stripeCustomerId: host.stripeCustomerId,
      contactEmail: host.contactEmail,
      billingEmail: host.billingEmail,
      users: host.users,
    });
    const chargeCard = await customerHasCardOnFile(customerId);

    // Separate Stripe line items so hosting and the $35 add-on stay distinct
    if (hostingAmount > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: toStripeAmount(hostingAmount),
        currency: plan.currency.toLowerCase(),
        description: hostingLine,
      });
    }
    if (addonAmount > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: toStripeAmount(addonAmount),
        currency: plan.currency.toLowerCase(),
        description: `${PRICING_INTELLIGENCE_ADDON_LABEL} — $${addonAmount}/mo add-on (not included in hosting)`,
      });
    }
    const processingCents = processingFeeToNetCents(toStripeAmount(amount));
    if (processingCents > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: processingCents,
        currency: plan.currency.toLowerCase(),
        description: `${CARD_PROCESSING_LINE} — so Yall Come Back nets the listed hosting price`,
      });
    }

    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      metadata: {
        hostId: host.id,
        planId: plan.id,
        kind: "hosting",
        propertyCount: String(propertyCount),
        pricingModel: plan.pricingModel,
        pricingIntelligenceAddon: addonActive ? "1" : "0",
        pricingIntelligenceAddonAmount: String(addonAmount),
      },
      ...(chargeCard
        ? { collection_method: "charge_automatically" as const }
        : { collection_method: "send_invoice" as const, days_until_due: 7 }),
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    if (!chargeCard) {
      try {
        await stripe.invoices.sendInvoice(finalized.id);
      } catch {
        // Test mode / restricted accounts may block send; hosted URL still works
      }
    }

    stripeInvoiceId = finalized.id;
    stripeHostedInvoiceUrl = finalized.hosted_invoice_url ?? null;
    status = finalized.status === "paid" ? "PAID" : "OPEN";
    chargedCardOnFile = chargeCard;
  }

  const record = await prisma.hostingInvoice.create({
    data: {
      hostId: host.id,
      planId: plan.id,
      amount,
      currency: plan.currency,
      pricingModel: plan.pricingModel,
      unitPrice,
      propertyCount,
      periodStart,
      periodEnd,
      status,
      dueDate,
      paidAt: status === "PAID" ? new Date() : undefined,
      stripeInvoiceId,
      stripeHostedInvoiceUrl,
      notes:
        opts.notes ||
        (chargedCardOnFile
          ? `Card on file · ${lineDescription}`
          : stripe
            ? `Stripe invoice sent · ${lineDescription}`
            : isStripeConfigured()
              ? `Stripe customer email missing - manual invoice · ${lineDescription}`
              : `Manual invoice (Stripe not enabled) · ${lineDescription}`),
    },
  });

  await prisma.host.update({
    where: { id: host.id },
    data: {
      planId: plan.id,
      subscriptionStatus:
        status === "PAID" || host.subscriptionStatus === "ACTIVE"
          ? "ACTIVE"
          : "PENDING_PAYMENT",
      billingEmail: billingEmail || host.billingEmail,
    },
  });

  return record;
}

export async function markHostingInvoicePaid(
  invoiceId: string,
  opts?: { stripeInvoiceId?: string }
) {
  const invoice = await prisma.hostingInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID") return invoice;

  const paid = await prisma.$transaction(async (tx) => {
    const updated = await tx.hostingInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        ...(opts?.stripeInvoiceId
          ? { stripeInvoiceId: opts.stripeInvoiceId }
          : {}),
      },
    });

    await tx.host.update({
      where: { id: invoice.hostId },
      data: {
        subscriptionStatus: "ACTIVE",
        currentPeriodStart: invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
        active: true,
        hostingPastDueAt: null,
        hostingDunningReminderSentAt: null,
      },
    });

    return updated;
  });

  return paid;
}

export async function markHostingInvoicePaidByStripeId(stripeInvoiceId: string) {
  const invoice = await prisma.hostingInvoice.findFirst({
    where: { stripeInvoiceId },
  });
  if (!invoice) return null;
  return markHostingInvoicePaid(invoice.id, { stripeInvoiceId });
}

/** Stripe Invoice fields we persist as a platform hosting invoice. */
export type StripeInvoiceLike = {
  id?: string | null;
  customer?: string | { id?: string } | null;
  customer_email?: string | null;
  amount_paid?: number | null;
  amount_due?: number | null;
  currency?: string | null;
  status?: string | null;
  hosted_invoice_url?: string | null;
  subscription?: string | { id?: string } | null;
  created?: number | null;
  due_date?: number | null;
  billing_reason?: string | null;
  period_start?: number | null;
  period_end?: number | null;
  metadata?: { kind?: string; hostId?: string } | null;
  status_transitions?: { paid_at?: number | null } | null;
  /** Stripe API 2025+: subscription lives on parent, not invoice.subscription. */
  parent?: {
    subscription_details?: {
      metadata?: { kind?: string; hostId?: string } | null;
      subscription?: string | { id?: string } | null;
    } | null;
  } | null;
  lines?: {
    data?: {
      description?: string | null;
      amount?: number | null;
      period?: { start?: number; end?: number } | null;
    }[];
  } | null;
};

const SKIP_INVOICE_KINDS = new Set([
  "calendar_block",
  "booking_deposit",
  "booking",
]);

function invoiceStatusFromStripe(status: string | null | undefined): HostingInvoiceStatus {
  switch (status) {
    case "paid":
      return "PAID";
    case "void":
      return "VOID";
    case "uncollectible":
      return "FAILED";
    case "draft":
      return "DRAFT";
    default:
      return "OPEN";
  }
}

function invoiceKindAndHostId(inv: StripeInvoiceLike): {
  kind: string;
  hostId: string;
} {
  const invoiceMeta = inv.metadata || {};
  const subMeta = inv.parent?.subscription_details?.metadata || {};
  return {
    kind: invoiceMeta.kind || subMeta.kind || "",
    hostId: invoiceMeta.hostId || subMeta.hostId || "",
  };
}

function invoiceSubscriptionId(inv: StripeInvoiceLike): string | null {
  return (
    stripeObjectId(inv.subscription) ||
    stripeObjectId(inv.parent?.subscription_details?.subscription)
  );
}

async function findHostForPlatformInvoice(inv: StripeInvoiceLike) {
  const { hostId } = invoiceKindAndHostId(inv);
  const customerId = stripeObjectId(inv.customer);
  const subscriptionId = invoiceSubscriptionId(inv);
  const email = inv.customer_email?.trim().toLowerCase() || "";

  if (hostId) {
    const byId = await prisma.host.findUnique({
      where: { id: hostId },
      include: { plan: true },
    });
    if (byId) return byId;
  }
  if (customerId) {
    const byCustomer = await prisma.host.findFirst({
      where: { stripeCustomerId: customerId },
      include: { plan: true },
    });
    if (byCustomer) return byCustomer;
  }
  if (subscriptionId) {
    const bySub = await prisma.host.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      include: { plan: true },
    });
    if (bySub) return bySub;
  }
  if (email) {
    const byEmail = await prisma.host.findFirst({
      where: {
        OR: [
          { billingEmail: { equals: email, mode: "insensitive" } },
          { contactEmail: { equals: email, mode: "insensitive" } },
          { users: { some: { email: { equals: email, mode: "insensitive" } } } },
        ],
      },
      include: { plan: true },
    });
    if (byEmail) return byEmail;
  }
  return null;
}

/**
 * Persist a platform Stripe invoice (hosting subscription or Ops invoice)
 * so Ops can see Checkout charges, not only invoices we created ourselves.
 */
export async function recordStripePlatformInvoice(inv: StripeInvoiceLike) {
  const stripeInvoiceId = inv.id || "";
  if (!stripeInvoiceId.startsWith("in_")) return null;
  const { kind } = invoiceKindAndHostId(inv);
  if (SKIP_INVOICE_KINDS.has(kind)) return null;

  const customerId = stripeObjectId(inv.customer);
  const subscriptionId = invoiceSubscriptionId(inv);
  const host = await findHostForPlatformInvoice(inv);
  if (!host) return null;

  const cents =
    inv.status === "paid"
      ? (inv.amount_paid ?? inv.amount_due ?? 0)
      : (inv.amount_due ?? inv.amount_paid ?? 0);
  const amount = Math.round(Number(cents) || 0) / 100;
  const line = inv.lines?.data?.[0];
  const periodStart = inv.period_start
    ? new Date(inv.period_start * 1000)
    : line?.period?.start
      ? new Date(line.period.start * 1000)
      : inv.created
        ? new Date(inv.created * 1000)
        : new Date();
  const periodEnd = inv.period_end
    ? new Date(inv.period_end * 1000)
    : line?.period?.end
      ? new Date(line.period.end * 1000)
      : addMonths(periodStart, 1);
  const publishedCount = await prisma.property.count({
    where: { hostId: host.id, published: true },
  });
  const billed = host.plan
    ? calculateHostingAmount(host.plan, publishedCount)
    : { propertyCount: Math.max(1, publishedCount), unitPrice: 0 };
  const status = invoiceStatusFromStripe(inv.status);
  const paidAtUnix =
    inv.status_transitions?.paid_at || (status === "PAID" ? inv.created : null);
  const notes = [
    inv.billing_reason
      ? `Stripe ${inv.billing_reason.replace(/_/g, " ")}`
      : "Stripe invoice",
    ...(inv.lines?.data || [])
      .map((l) => l.description)
      .filter((d): d is string => Boolean(d)),
  ]
    .join(" · ")
    .slice(0, 500);

  const payload = {
    hostId: host.id,
    planId: host.planId,
    amount,
    currency: (inv.currency || "usd").toUpperCase(),
    pricingModel: host.plan?.pricingModel ?? ("PER_PROPERTY" as const),
    unitPrice: billed.unitPrice,
    propertyCount: billed.propertyCount,
    periodStart,
    periodEnd,
    dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
    status,
    paidAt: paidAtUnix ? new Date(paidAtUnix * 1000) : null,
    stripeInvoiceId,
    stripeHostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    notes,
  };

  const existing = await prisma.hostingInvoice.findUnique({
    where: { stripeInvoiceId },
  });
  const record = existing
    ? await prisma.hostingInvoice.update({
        where: { id: existing.id },
        data: {
          amount: payload.amount,
          status: payload.status,
          paidAt: payload.paidAt ?? existing.paidAt,
          dueDate: payload.dueDate ?? existing.dueDate,
          stripeHostedInvoiceUrl: payload.stripeHostedInvoiceUrl,
          notes: payload.notes,
        },
      })
    : await prisma.hostingInvoice.create({ data: payload });

  if (status === "PAID" && amount > 0) {
    await prisma.host.update({
      where: { id: host.id },
      data: {
        subscriptionStatus: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        hostingPastDueAt: null,
        hostingDunningReminderSentAt: null,
        stripeCustomerId: customerId || host.stripeCustomerId,
        stripeSubscriptionId: subscriptionId || host.stripeSubscriptionId,
      },
    });
  }
  return record;
}

/** Pull recent platform Stripe invoices into HostingInvoice rows. */
export async function syncPlatformInvoicesFromStripe(): Promise<{
  synced: number;
  error: string | null;
}> {
  const stripe = getStripe();
  if (!stripe) return { synced: 0, error: null };
  let synced = 0;
  try {
    for (const status of ["paid", "open"] as const) {
      const list = await stripe.invoices.list({
        limit: 100,
        status,
        expand: ["data.lines"],
      });
      for (const inv of list.data) {
        const rec = await recordStripePlatformInvoice(inv);
        if (rec) synced += 1;
      }
    }
    return { synced, error: null };
  } catch (e) {
    return {
      synced,
      error: e instanceof Error ? e.message : "Could not read Stripe invoices",
    };
  }
}
