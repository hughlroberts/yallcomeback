import { prisma } from "@/lib/db";
import { processScheduledBookingMessages } from "@/lib/booking-messages";
import { syncIcalConnection } from "@/lib/ical";

export type IcalSyncResult = {
  synced: number;
  results: { id: string; name: string; [key: string]: unknown }[];
};

export type BookingMessagesResult = {
  ok: true;
  at: string;
  results: Awaited<ReturnType<typeof processScheduledBookingMessages>>;
};

/** Pull external calendar blocks for every enabled iCal import. */
export async function runIcalSync(): Promise<IcalSyncResult> {
  const connections = await prisma.icalConnection.findMany({
    where: {
      enabled: true,
      importUrl: { not: null },
    },
  });

  const results = [];
  for (const c of connections) {
    const result = await syncIcalConnection(c.id);
    results.push({ id: c.id, name: c.name, ...result });
  }

  return { synced: results.length, results };
}

/** Deliver week-before / day-before booking auto-messages. */
export async function runBookingMessages(): Promise<BookingMessagesResult> {
  const results = await processScheduledBookingMessages();
  return {
    ok: true,
    at: new Date().toISOString(),
    results,
  };
}

/** Both jobs (used by in-process scheduler). */
export async function runAllCronJobs(): Promise<{
  ical: IcalSyncResult;
  messages: BookingMessagesResult;
  hostingPayments: import("@/lib/hosting-payment-check").HostingPaymentCheckResult;
  backup: import("@/lib/backup").DailyBackupResult;
  pricing?: { skipped: boolean; hostsProcessed: number; errors: string[] };
}> {
  const ical = await runIcalSync();
  const messages = await runBookingMessages();
  try {
    const { expireAbandonedAgentCheckouts } = await import(
      "@/lib/agent/checkout"
    );
    const expired = await expireAbandonedAgentCheckouts();
    if (expired.cancelled > 0) {
      console.log(`[cron] expired ${expired.cancelled} unpaid agent checkouts`);
    }
  } catch (e) {
    console.error("[cron:agent-checkout-expiry]", e);
  }
  let hostingPayments: import("@/lib/hosting-payment-check").HostingPaymentCheckResult =
    {
      skipped: true,
      ranAt: new Date().toISOString(),
      checked: 0,
      confirmedPaid: 0,
      markedPastDue: 0,
      reminded: 0,
      paused: 0,
      errors: [],
    };
  try {
    const { maybeRunDailyHostingPaymentCheck } = await import(
      "@/lib/hosting-payment-check"
    );
    hostingPayments = await maybeRunDailyHostingPaymentCheck();
  } catch (e) {
    console.error("[cron:hosting-payments]", e);
  }

  let backup: import("@/lib/backup").DailyBackupResult = {
    skipped: true,
    ranAt: new Date().toISOString(),
    persisted: false,
    summary: "not attempted",
  };
  try {
    const { maybeRunDailyBackup } = await import("@/lib/backup");
    backup = await maybeRunDailyBackup();
  } catch (e) {
    console.error("[cron:backup]", e);
    backup = {
      skipped: false,
      ranAt: new Date().toISOString(),
      persisted: false,
      summary: e instanceof Error ? e.message : "backup failed",
    };
  }

  // Once a host has a completed run in the last 28 days, this is a no-op.
  // There is no public HTTP trigger.
  let pricing: { skipped: boolean; hostsProcessed: number; errors: string[] } =
    { skipped: true, hostsProcessed: 0, errors: [] };
  try {
    const { runMonthlyPricingIntelligence } = await import(
      "@/lib/pricing-intelligence/run"
    );
    pricing = await runMonthlyPricingIntelligence();
  } catch (e) {
    console.error("[cron:pricing]", e);
    pricing = {
      skipped: false,
      hostsProcessed: 0,
      errors: [e instanceof Error ? e.message : "pricing failed"],
    };
  }

  return { ical, messages, hostingPayments, backup, pricing };
}
