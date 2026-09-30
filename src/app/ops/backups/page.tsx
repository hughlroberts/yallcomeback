import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { backupOpsSnapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backups · Ops" };

function ageLabel(at: Date | null, now: Date): string {
  if (!at) return "Never";
  const hours = (now.getTime() - at.getTime()) / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)} min ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default async function OpsBackupsPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/backups");

  const [snap, propertyCount, hostCount, invoiceCount, bookingCount] =
    await Promise.all([
      backupOpsSnapshot(),
      prisma.property.count(),
      prisma.host.count(),
      prisma.hostingInvoice.count(),
      prisma.booking.count(),
    ]);
  const { last, stale } = snap;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Backups
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Full copy of listings, hosts, calendar, bookings, and website hosting
          history. Daily encrypted copies live on GitHub (off Railway) so a hack
          that wipes the database is recoverable.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-ink">Last off-site backup</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Status</dt>
            <dd
              className={`mt-0.5 font-medium ${stale ? "text-amber-800" : "text-emerald-800"}`}
            >
              {!last
                ? "Never run"
                : last.lastOk
                  ? "OK"
                  : "Last run failed"}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">When</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {last?.lastFinishedAt
                ? `${last.lastFinishedAt.toLocaleString()} · ${ageLabel(last.lastFinishedAt, snap.now)}`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-stone-500">Summary</dt>
            <dd className="mt-0.5 font-mono text-xs text-stone-700">
              {last?.lastSummary || "No run recorded yet. Trigger GitHub Actions → Daily full backup, or download one now."}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/ops/backups/download"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-bonnet-hover"
          >
            Download backup now
          </a>
          <Link
            href="https://github.com/hughlroberts/yallcomeback/actions/workflows/cron-backup.yml"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-lupine/50 bg-porcelain px-5 py-2.5 text-sm font-medium text-bonnet shadow-sm hover:bg-petal"
            target="_blank"
            rel="noreferrer"
          >
            GitHub Actions runs
          </Link>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          The download is a gzipped JSON dump. Daily GitHub copies are encrypted
          with BACKUP_ENCRYPTION_KEY (password manager — not this site).
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">What is in a backup</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-700">
          <li>
            {propertyCount} listing{propertyCount === 1 ? "" : "s"} (photos as
            URLs; local /uploads files when they still fit)
          </li>
          <li>
            {hostCount} host brand{hostCount === 1 ? "" : "s"} including domain,
            plan, Stripe customer, and marketplace opt-in
          </li>
          <li>
            {invoiceCount} hosting invoice{invoiceCount === 1 ? "" : "s"} (paid
            and unpaid history)
          </li>
          <li>
            {bookingCount} booking{bookingCount === 1 ? "" : "s"}, calendar
            blocks, guests, messages, and users
          </li>
        </ul>
        <p className="mt-4 text-sm text-stone-600">
          Restore steps:{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">
            docs/backup-and-restore.md
          </code>
        </p>
      </Card>
    </div>
  );
}
