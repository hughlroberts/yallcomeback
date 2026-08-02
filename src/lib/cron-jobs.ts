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
  pricing?: { skipped: boolean; hostsProcessed: number; errors: string[] };
}> {
  const ical = await runIcalSync();
  const messages = await runBookingMessages();

  // Monthly pricing intelligence: only if explicitly enabled in-process.
  // Prefer external monthly hit to /api/cron/pricing-intelligence.
  let pricing:
    | { skipped: boolean; hostsProcessed: number; errors: string[] }
    | undefined;
  if (
    process.env.PRICING_INTELLIGENCE_MONTHLY_IN_PROCESS?.trim().toLowerCase() ===
    "true"
  ) {
    const { runMonthlyPricingIntelligence } = await import(
      "@/lib/pricing-intelligence/run"
    );
    pricing = await runMonthlyPricingIntelligence();
  }

  return { ical, messages, pricing };
}
