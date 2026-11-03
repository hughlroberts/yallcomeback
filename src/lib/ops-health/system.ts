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

  const cronInProcess =
    process.env.CRON_IN_PROCESS === "true" ||
    (process.env.CRON_IN_PROCESS !== "false" &&
      process.env.NODE_ENV === "production");

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

  if (!cronInProcess) {
    findings.push({
      id: "cron:none",
      checkId: "cron_configured",
      severity: "warning",
      title: "In-process scheduler is off",
      detail:
        "Calendar imports, booking messages, hosting payments, and the daily backup run inside the server. Set CRON_IN_PROCESS=true.",
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
          detail:
            last.lastSummary ||
            "The in-process scheduler runs this once per UTC day. Restart the service if it has not caught up.",
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

  try {
    const { lastBackupRun, backupRunIsStale, backupStorageStatus } =
      await import("@/lib/backup");
    const storage = await backupStorageStatus();
    const b = storage.bucket;
    const bucketOk = b.configured && !b.keyMissing && b.reachable;
    const storageOk = bucketOk || storage.writable;
    rows.push({
      label: "Backup storage",
      value: bucketOk
        ? `Bucket OK · ${b.fileCount} file${b.fileCount === 1 ? "" : "s"}${storage.configured ? " · volume still attached" : ""}`
        : storage.writable
          ? `Volume OK · ${storage.fileCount} file${storage.fileCount === 1 ? "" : "s"}`
          : !storage.configured && !b.configured
            ? "Not set"
            : "Not writable",
      tone: storageOk ? "ok" : "bad",
    });
    if (b.configured && !bucketOk) {
      findings.push({
        id: "backup:bucket",
        checkId: "backup_check",
        severity: storage.writable ? "warning" : "critical",
        title: b.keyMissing
          ? "Backup bucket has no valid encryption key"
          : "Backup bucket is not reachable",
        detail: b.keyMissing
          ? "Set BACKUP_ENCRYPTION_KEY (32 bytes, hex or base64). Backups are never uploaded unencrypted."
          : b.error || "Check the BACKUP_S3_* variables.",
        href: "/ops/settings/backups",
      });
    }
    if (!storageOk && !(b.configured && !bucketOk)) {
      findings.push({
        id: "backup:volume",
        checkId: "backup_check",
        severity: "critical",
        title: storage.configured
          ? "Backup volume is not writable"
          : "Backup storage is not configured",
        detail:
          storage.error ||
          "Set the BACKUP_S3_* variables and BACKUP_ENCRYPTION_KEY (see docs/backup-and-restore.md).",
        href: "/ops/settings/backups",
      });
    }
    const last = await lastBackupRun();
    if (!last?.lastFinishedAt) {
      rows.push({
        label: "Daily full backup",
        value: "Never run",
        tone: "warn",
      });
      findings.push({
        id: "backup:never",
        checkId: "backup_check",
        severity: "warning",
        title: "No Railway backup has been recorded",
        detail:
          "The daily job writes gzipped dumps to backup storage. Ops → Platform settings → Backups can also run one now.",
        href: "/ops/settings/backups",
      });
    } else {
      const ageH =
        (now.getTime() - last.lastFinishedAt.getTime()) / 3_600_000;
      const stale = backupRunIsStale(last, now);
      rows.push({
        label: "Daily full backup",
        value: `${last.lastOk ? "OK" : "Failed"} · ${Math.round(ageH)}h ago`,
        tone: stale ? "warn" : "ok",
      });
      if (stale) {
        findings.push({
          id: "backup:stale",
          checkId: "backup_check",
          severity: ageH > 36 ? "critical" : "warning",
          title: ageH > 36
            ? "Railway backup is stale"
            : "Last Railway backup failed",
          detail:
            last.lastSummary ||
            "Run Ops → Platform settings → Backups → Run backup now.",
          href: "/ops/settings/backups",
        });
      }
    }
  } catch {
    rows.push({
      label: "Daily full backup",
      value: "Unavailable",
      tone: "warn",
    });
  }

  return { findings, rows };
}
