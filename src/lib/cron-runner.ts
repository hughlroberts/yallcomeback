/**
 * In-process scheduler for Railway / long-running Node server.
 * Runs the same work as /api/cron/* so you don't need an external pinger.
 *
 * Control with env:
 *   CRON_IN_PROCESS=true|false  (default: on in production, off in dev)
 *   CRON_INTERVAL_MS=1200000    (default 20 minutes; min 5 minutes)
 */

import { runAllCronJobs } from "@/lib/cron-jobs";

const globalForCron = globalThis as unknown as {
  __ycbCronStarted?: boolean;
  __ycbCronTimer?: ReturnType<typeof setInterval>;
};

function cronEnabled(): boolean {
  const raw = process.env.CRON_IN_PROCESS?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  // Default: production only (Railway)
  return process.env.NODE_ENV === "production";
}

function intervalMs(): number {
  const raw = Number(process.env.CRON_INTERVAL_MS || 20 * 60 * 1000);
  // Floor at 5 minutes to avoid hammering OTAs / DB
  return Number.isFinite(raw) ? Math.max(5 * 60 * 1000, raw) : 20 * 60 * 1000;
}

async function tick() {
  const started = Date.now();
  try {
    const result = await runAllCronJobs();
    const m = result.messages.results;
    const sent =
      (m.weekBefore?.sent ?? 0) + (m.dayBefore?.sent ?? 0);
    console.log(
      `[cron] ok in ${Date.now() - started}ms · ical=${result.ical.synced} · messages_sent=${sent}`,
    );
  } catch (e) {
    console.error("[cron] failed", e);
  }
}

/**
 * Start the interval once per process. Safe under hot reload (dev) and multi-import.
 */
export function startInProcessCron() {
  if (!cronEnabled()) {
    console.log("[cron] in-process scheduler disabled");
    return;
  }
  if (globalForCron.__ycbCronStarted) return;
  globalForCron.__ycbCronStarted = true;

  const ms = intervalMs();
  console.log(
    `[cron] in-process scheduler starting (every ${Math.round(ms / 60000)} min)`,
  );

  // Delay first run slightly so the server finishes booting / DB is ready
  const first = setTimeout(() => {
    void tick();
  }, 45_000);

  globalForCron.__ycbCronTimer = setInterval(() => {
    void tick();
  }, ms);

  // Unref so the timer doesn't keep the process alive during short scripts
  if (typeof first.unref === "function") first.unref();
  if (
    globalForCron.__ycbCronTimer &&
    typeof globalForCron.__ycbCronTimer.unref === "function"
  ) {
    globalForCron.__ycbCronTimer.unref();
  }
}
