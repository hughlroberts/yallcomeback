/**
 * Hosting dunning: 3-day grace, reminder + pause at 5 unpaid days.
 * Paused hosts keep existing listings; they cannot add new work.
 */

import { prisma } from "@/lib/db";
import { PRODUCT_NAME } from "@/lib/features";
import {
  HOSTING_REMINDER_AND_PAUSE_DAYS,
} from "@/lib/hosting";
import {
  dispatchPlatformEmail,
  messagingSiteOrigin,
} from "@/lib/messaging";

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

function hostBillingEmail(host: {
  billingEmail: string | null;
  contactEmail: string | null;
  users: { email: string | null }[];
}): string | null {
  return (
    host.billingEmail?.trim() ||
    host.contactEmail?.trim() ||
    host.users[0]?.email?.trim() ||
    null
  );
}

export async function markHostingPastDue(hostId: string): Promise<void> {
  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host || host.hostingMode !== "PLATFORM") return;
  if (host.subscriptionStatus === "PAUSED") return;
  if (host.subscriptionStatus === "CANCELLED") return;
  await prisma.host.update({
    where: { id: hostId },
    data: {
      subscriptionStatus: "PAST_DUE",
      hostingPastDueAt: host.hostingPastDueAt ?? new Date(),
    },
  });
}

export async function clearHostingDunning(hostId: string): Promise<void> {
  await prisma.host.update({
    where: { id: hostId },
    data: {
      hostingPastDueAt: null,
      hostingDunningReminderSentAt: null,
    },
  });
}

export async function pauseHostingForNonPayment(hostId: string): Promise<void> {
  await prisma.host.update({
    where: { id: hostId },
    data: { subscriptionStatus: "PAUSED" },
  });
}

async function sendDunningReminder(host: {
  id: string;
  name: string;
  billingEmail: string | null;
  contactEmail: string | null;
  users: { email: string | null }[];
}): Promise<boolean> {
  const to = hostBillingEmail(host);
  if (!to) return false;
  const payUrl = `${messagingSiteOrigin()}/admin/payments`;
  const result = await dispatchPlatformEmail({
    to,
    subject: `${PRODUCT_NAME} hosting is unpaid — add a card to keep taking new stays`,
    text: [
      `Hi ${host.name},`,
      "",
      `We have not received your ${PRODUCT_NAME} hosting payment.`,
      "You had a 3-day grace period. It has been 5 days.",
      "",
      "Hosting is now paused for new work. Existing listings and bookings stay in place. You can still manage them. You cannot add new listings or take new stays until you pay.",
      "",
      `Pay here: ${payUrl}`,
      "",
      PRODUCT_NAME,
    ].join("\n"),
  });
  return result.status === "sent" || result.status === "skipped";
}

export async function processHostingDunning(now = new Date()): Promise<{
  pastDueSeeded: number;
  reminded: number;
  paused: number;
}> {
  const seeded = await prisma.host.updateMany({
    where: {
      hostingMode: "PLATFORM",
      subscriptionStatus: "PAST_DUE",
      hostingPastDueAt: null,
    },
    data: { hostingPastDueAt: now },
  });

  const hosts = await prisma.host.findMany({
    where: {
      hostingMode: "PLATFORM",
      hostingPastDueAt: { not: null },
      subscriptionStatus: { in: ["PAST_DUE", "PAUSED"] },
    },
    include: { users: { where: { role: "HOST" }, take: 1 } },
  });

  let reminded = 0;
  let paused = 0;
  for (const host of hosts) {
    const started = host.hostingPastDueAt;
    if (!started) continue;
    const days = daysBetween(started, now);
    if (days < HOSTING_REMINDER_AND_PAUSE_DAYS) continue;

    if (!host.hostingDunningReminderSentAt) {
      const ok = await sendDunningReminder(host);
      await prisma.host.update({
        where: { id: host.id },
        data: { hostingDunningReminderSentAt: now },
      });
      if (ok) reminded += 1;
    }

    if (host.subscriptionStatus !== "PAUSED") {
      await pauseHostingForNonPayment(host.id);
      paused += 1;
    }
  }

  return { pastDueSeeded: seeded.count, reminded, paused };
}
