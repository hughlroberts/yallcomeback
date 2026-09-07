import { prisma } from "@/lib/db";
import type { HealthFinding, SystemStatusRow } from "./types";

export async function runSystemChecks(): Promise<{
  findings: HealthFinding[];
  rows: SystemStatusRow[];
}> {
  const findings: HealthFinding[] = [];
  const rows: SystemStatusRow[] = [];

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  rows.push({
    label: "Database",
    value: dbOk ? "Reachable" : "Unreachable",
    tone: dbOk ? "ok" : "bad",
  });

  if (!dbOk) {
    findings.push({
      id: "db:down",
      checkId: "db_ok",
      severity: "critical",
      title: "Database unreachable",
      detail: "Health checks could not query the database. Booking and listing data may be stale or unavailable.",
    });
    return { findings, rows };
  }

  const cronSecret = Boolean(process.env.CRON_SECRET?.trim());
  const cronInProcess =
    process.env.CRON_IN_PROCESS === "true" ||
    (process.env.CRON_IN_PROCESS !== "false" &&
      process.env.NODE_ENV === "production");

  rows.push({
    label: "Cron secret configured",
    value: cronSecret ? "Yes" : "No",
    tone: cronSecret ? "ok" : "warn",
  });
  rows.push({
    label: "In-process scheduler",
    value: cronInProcess ? "On" : "Off",
    tone: "neutral",
  });
  rows.push({
    label: "Node environment",
    value: process.env.NODE_ENV || "unknown",
    tone: "neutral",
  });

  const now = new Date();
  const in90 = new Date(now);
  in90.setDate(in90.getDate() + 90);

  const [
    propertyCount,
    publishedCount,
    activeBookingCount,
    icalEnabled,
    icalErrors,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.property.count({ where: { published: true } }),
    prisma.booking.count({
      where: {
        status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
        checkIn: { lte: in90 },
        checkOut: { gte: now },
      },
    }),
    prisma.icalConnection.count({ where: { enabled: true } }),
    prisma.icalConnection.count({
      where: { enabled: true, lastSyncError: { not: null } },
    }),
  ]);

  rows.push({
    label: "Properties (published / all)",
    value: `${publishedCount} / ${propertyCount}`,
    tone: "neutral",
  });
  rows.push({
    label: "Active bookings (next 90 days)",
    value: String(activeBookingCount),
    tone: "neutral",
  });
  rows.push({
    label: "Calendar imports enabled",
    value: String(icalEnabled),
    tone: "neutral",
  });
  rows.push({
    label: "Calendar imports with sync errors",
    value: String(icalErrors),
    tone: icalErrors > 0 ? "warn" : "ok",
  });

  if (!cronSecret && !cronInProcess) {
    findings.push({
      id: "cron:none",
      checkId: "cron_configured",
      severity: "warning",
      title: "No cron path configured",
      detail: "Neither CRON_SECRET nor in-process scheduler is clearly active. Calendar imports and auto messages may not run.",
    });
  }

  try {
    const { lastDailyHostingPaymentCheck } = await import(
      "@/lib/hosting-payment-check"
    );
    const last = await lastDailyHostingPaymentCheck();
    if (!last?.lastFinishedAt) {
      rows.push({
        label: "Daily hosting payment check",
        value: "Never run",
        tone: "warn",
      });
      findings.push({
        id: "cron:hosting-payments-never",
        checkId: "hosting_payment_check",
        severity: "warning",
        title: "Hosting payment check has not run",
        detail: "The daily job that confirms hosting payments with Stripe has no successful run yet.",
      });
    } else {
      const ageH =
        (now.getTime() - last.lastFinishedAt.getTime()) / 3_600_000;
      const stale = ageH > 36;
      rows.push({
        label: "Daily hosting payment check",
        value: `${last.lastOk ? "OK" : "Failed"} · ${Math.round(ageH)}h ago`,
        tone: stale || !last.lastOk ? "warn" : "ok",
      });
      if (stale || !last.lastOk) {
        findings.push({
          id: "cron:hosting-payments-stale",
          checkId: "hosting_payment_check",
          severity: stale ? "critical" : "warning",
          title: stale
            ? "Hosting payment check is stale"
            : "Hosting payment check last run failed",
          detail: last.lastSummary || "Run GET /api/cron/hosting-payments with CRON_SECRET.",
        });
      }
    }
  } catch {
    rows.push({
      label: "Daily hosting payment check",
      value: "Unavailable",
      tone: "warn",
    });
  }

  return { findings, rows };
}
