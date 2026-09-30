import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BACKUP_RETENTION_DAYS, backupOpsSnapshot } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backups · Ops" };

function ageLabel(at: Date | null, now: Date): string {
  if (!at) return "Never";
  const hours = (now.getTime() - at.getTime()) / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)} min ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function OpsBackupsPage() {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/settings/backups");

  const [snap, propertyCount, hostCount, invoiceCount, bookingCount] =
    await Promise.all([
      backupOpsSnapshot(),
      prisma.property.count(),
      prisma.host.count(),
      prisma.hostingInvoice.count(),
      prisma.booking.count(),
    ]);
  const { last, stale, storage, files } = snap;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Backups
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Full copy of listings, hosts, calendar, bookings, and website hosting
          history. Copies are stored on a Railway volume (separate from
          Postgres) and kept {BACKUP_RETENTION_DAYS} days.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-ink">Railway volume</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Storage</dt>
            <dd
              className={`mt-0.5 font-medium ${storage.writable ? "text-emerald-800" : "text-amber-800"}`}
            >
              {!storage.configured
                ? "BACKUP_DIR not set"
                : storage.writable
                  ? `Writable · ${storage.fileCount} file${storage.fileCount === 1 ? "" : "s"}`
                  : `Not writable${storage.error ? ` · ${storage.error}` : ""}`}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Path</dt>
            <dd className="mt-0.5 font-mono text-xs text-stone-700">
              {storage.dir || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Last run</dt>
            <dd
              className={`mt-0.5 font-medium ${stale ? "text-amber-800" : "text-emerald-800"}`}
            >
              {!last
                ? "Never"
                : `${last.lastOk ? "OK" : "Failed"} · ${ageLabel(last.lastFinishedAt, snap.now)}`}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Summary</dt>
            <dd className="mt-0.5 font-mono text-xs text-stone-700">
              {last?.lastSummary || "No run yet"}
            </dd>
          </div>
        </dl>
        <div className="mt-6">
          <a
            href="/ops/settings/backups/download"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-bonnet-hover"
          >
            Run backup now
          </a>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Writes a gzipped dump onto the volume and downloads it. The in-process
          scheduler also takes one copy per UTC day.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">Stored copies</h2>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            No files on the volume yet. Use Run backup now, or wait for the
            daily job after this volume is mounted.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
              >
                <div>
                  <p className="font-mono text-xs text-stone-800">{f.name}</p>
                  <p className="text-xs text-stone-500">
                    {new Date(f.mtime).toLocaleString()} · {bytesLabel(f.size)}
                  </p>
                </div>
                <a
                  href={`/ops/settings/backups/file/${encodeURIComponent(f.name)}`}
                  className="font-medium text-bonnet hover:underline"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
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
