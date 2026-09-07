/**
 * Next.js instrumentation — runs once when the Node server starts.
 * Starts background cron (iCal, booking messages, daily hosting payment check).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startInProcessCron } = await import("./lib/cron-runner");
    startInProcessCron();
  }
}
