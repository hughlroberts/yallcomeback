/**
 * One-shot cron runner (for external schedulers or Railway cron services).
 *
 *   npx tsx scripts/run-cron.ts
 *   npx tsx scripts/run-cron.ts ical
 *   npx tsx scripts/run-cron.ts messages
 *   npx tsx scripts/run-cron.ts hosting
 */
import {
  runAllCronJobs,
  runBookingMessages,
  runIcalSync,
} from "../src/lib/cron-jobs";
import { runDailyHostingPaymentCheck } from "../src/lib/hosting-payment-check";

async function main() {
  const which = (process.argv[2] || "all").toLowerCase();
  if (which === "ical") {
    console.log(JSON.stringify(await runIcalSync(), null, 2));
  } else if (which === "messages") {
    console.log(JSON.stringify(await runBookingMessages(), null, 2));
  } else if (which === "hosting" || which === "payments") {
    console.log(JSON.stringify(await runDailyHostingPaymentCheck(), null, 2));
  } else {
    console.log(JSON.stringify(await runAllCronJobs(), null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  });
