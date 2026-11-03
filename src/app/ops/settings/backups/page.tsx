import { Card } from "@/components/ui";
import { requirePlatformAdminOr404 } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BACKUP_RETENTION_DAYS, backupOpsSnapshot } from "@/lib/backup";
import { SubmitButton } from "@/components/submit-button";
import { copyBackupsToBucket } from "./actions";
import { moveCardState } from "@/lib/backup-move-card";

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

type CopyResult = {
  copy?: string;
  total?: string;
  verified?: string;
  todo?: string;
  bad?: string;
  msg?: string;
};

function copyNotice(r: CopyResult): { tone: "ok" | "warn"; text: string } | null {
  if (!r.copy) return null;
  if (r.copy === "error") return { tone: "warn", text: `Copy did not run: ${r.msg || "error"}` };
  if (r.copy === "dry") {
    return {
      tone: "ok",
      text: `Check only: ${r.total} on the volume, ${r.verified} already in the bucket with the same checksum, ${r.todo} to copy.`,
    };
  }
  if (r.copy === "ok") {
    return {
      tone: "ok",
      text: `Done: all ${r.total} volume copies are in the bucket, read back, and match (sha256). Nothing was deleted.`,
    };
  }
  return {
    tone: "warn",
    text: `Not complete: ${r.verified} of ${r.total} verified.${r.bad ? ` Problem files: ${r.bad}.` : ""} Do not detach the volume. Run it again.`,
  };
}

export default async function OpsBackupsPage({
  searchParams,
}: {
  searchParams: Promise<CopyResult>;
}) {
  await requirePlatformAdminOr404();
  const notice = copyNotice(await searchParams);
  const [snap, propertyCount, hostCount, invoiceCount, bookingCount] =
    await Promise.all([
      backupOpsSnapshot(),
      prisma.property.count(),
      prisma.host.count(),
      prisma.hostingInvoice.count(),
      prisma.booking.count(),
    ]);
  const { last, stale, storage, files } = snap;
  const move = moveCardState(storage);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Backups
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Full copy of listings, hosts, calendar, bookings, and website hosting
          history. Copies are stored in an encrypted bucket (and on the old
          volume while it is attached), separate from Postgres, and kept{" "}
          {BACKUP_RETENTION_DAYS} days.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold text-ink">Storage</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Bucket</dt>
            <dd
              className={`mt-0.5 font-medium ${storage.bucket.reachable && !storage.bucket.keyMissing ? "text-emerald-800" : "text-amber-800"}`}
            >
              {!storage.bucket.configured
                ? "Not set (BACKUP_S3_*)"
                : storage.bucket.keyMissing
                  ? "BACKUP_ENCRYPTION_KEY missing or not 32 bytes"
                  : storage.bucket.reachable
                    ? `Encrypted · ${storage.bucket.fileCount} file${storage.bucket.fileCount === 1 ? "" : "s"}`
                    : `Not reachable${storage.bucket.error ? ` · ${storage.bucket.error}` : ""}`}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Volume</dt>
            <dd
              className={`mt-0.5 font-medium ${storage.writable ? "text-emerald-800" : "text-stone-700"}`}
            >
              {!storage.configured
                ? "Not attached (BACKUP_DIR not set)"
                : storage.writable
                  ? `Writable · ${storage.fileCount} file${storage.fileCount === 1 ? "" : "s"}`
                  : `Not writable${storage.error ? ` · ${storage.error}` : ""}`}
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Volume path</dt>
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
          Writes a gzipped dump to storage and downloads it. The in-process
          scheduler also takes one copy per UTC day.
        </p>
      </Card>

      <Card id="move">
        <h2 className="font-semibold text-ink">Move volume copies to the bucket</h2>
        <p className="mt-2 text-sm text-stone-600">
          Copies every file on the volume into the bucket, reads each one
          back, and compares checksums. It does not delete or change volume
          files. Detach the volume only after this says all files match.
        </p>
        {move.enabled ? null : (
          <div
            id="move-not-ready"
            className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <p className="font-medium">Not available yet.</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {move.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="mt-1">Then redeploy and open this page again.</p>
          </div>
        )}
        {notice ? (
          <p
            role="status"
            className={`mt-3 rounded-md px-3 py-2 text-sm ${notice.tone === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}
          >
            {notice.text}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={copyBackupsToBucket}>
            <input type="hidden" name="dryRun" value="1" />
            <SubmitButton
              variant="secondary"
              pendingLabel="Checking…"
              disabled={!move.enabled}
              aria-describedby={move.enabled ? undefined : "move-not-ready"}
            >
              Check only
            </SubmitButton>
          </form>
          <form action={copyBackupsToBucket}>
            <SubmitButton
              pendingLabel="Copying…"
              disabled={!move.enabled}
              aria-describedby={move.enabled ? undefined : "move-not-ready"}
            >
              Copy and verify
            </SubmitButton>
          </form>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">Stored copies</h2>
        {files.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">
            No stored copies yet. Use Run backup now, or wait for the daily
            job after storage is set.
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
                    {new Date(f.mtime).toLocaleString()} · {bytesLabel(f.size)} ·{" "}
                    {f.location === "bucket" ? "Bucket" : "Volume"}
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
