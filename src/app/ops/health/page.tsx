import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseHealthTab, runHealthChecks } from "@/lib/ops-health/run";
import type {
  HealthFinding,
  HealthSeverity,
  HealthTab,
} from "@/lib/ops-health/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Health · Ops" };

const TABS: { id: HealthTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "calendar", label: "Calendar risk" },
  { id: "listings", label: "Listing data" },
  { id: "system", label: "System" },
];

function severityClass(s: HealthSeverity): string {
  switch (s) {
    case "critical":
      return "bg-rose-100 text-rose-900";
    case "warning":
      return "bg-amber-100 text-amber-950";
    case "info":
      return "bg-sky-100 text-sky-900";
    default:
      return "bg-emerald-100 text-emerald-900";
  }
}

function toneClass(tone: "ok" | "warn" | "bad" | "neutral"): string {
  switch (tone) {
    case "ok":
      return "text-emerald-800";
    case "warn":
      return "text-amber-800";
    case "bad":
      return "text-rose-800";
    default:
      return "text-stone-800";
  }
}

function FindingsTable({ findings }: { findings: HealthFinding[] }) {
  if (findings.length === 0) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        No issues found for this view.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Severity</th>
            <th className="px-4 py-3 font-semibold">Issue</th>
            <th className="px-4 py-3 font-semibold">Host / listing</th>
            <th className="px-4 py-3 font-semibold">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {findings.map((f) => (
            <tr key={f.id} className="align-top">
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${severityClass(f.severity)}`}
                >
                  {f.severity}
                </span>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-stone-900">{f.title}</p>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-stone-600">
                  {f.detail}
                </p>
              </td>
              <td className="px-4 py-3 text-xs text-stone-600">
                {f.hostName ? (
                  <p className="font-medium text-stone-800">{f.hostName}</p>
                ) : null}
                {f.propertyTitle ? (
                  <p className="mt-0.5">{f.propertyTitle}</p>
                ) : null}
                {f.bookingId ? (
                  <p className="mt-0.5 font-mono text-[10px] text-stone-400">
                    booking {f.bookingId.slice(0, 10)}…
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {f.href ? (
                  <Link
                    href={f.href}
                    className="text-sm font-semibold text-bonnet hover:underline"
                  >
                    Open →
                  </Link>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OpsHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; hostId?: string }>;
}) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/health");

  const sp = await searchParams;
  const tab = parseHealthTab(sp.tab);
  const hostId = sp.hostId?.trim() || "";

  const hosts = await prisma.host.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const report = await runHealthChecks({
    tab,
    hostId: hostId || undefined,
  });

  const tabHref = (id: HealthTab) => {
    const q = new URLSearchParams();
    if (id !== "overview") q.set("tab", id);
    if (hostId) q.set("hostId", hostId);
    const s = q.toString();
    return s ? `/ops/health?${s}` : "/ops/health";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Health & integrity
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Catch calendar double-holds, missing booking blocks, broken listings,
          and sync problems before guests are affected. This page detects issues
          — it does not auto-fix bookings.
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Checked {new Date(report.summary.checkedAt).toLocaleString()}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        {tab !== "overview" ? (
          <input type="hidden" name="tab" value={tab} />
        ) : null}
        <div>
          <label
            htmlFor="hostId"
            className="block text-xs font-semibold uppercase tracking-wide text-stone-500"
          >
            Filter by host
          </label>
          <select
            id="hostId"
            name="hostId"
            defaultValue={hostId}
            className="mt-1 h-10 rounded-xl border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="">All hosts</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-xl bg-stone-900 px-4 text-sm font-semibold text-white hover:bg-stone-800"
        >
          Apply
        </button>
      </form>

      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={tabHref(t.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-bonnet text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-muted">Critical</p>
          <p
            className={`mt-1 text-3xl font-semibold ${
              report.summary.critical > 0 ? "text-rose-700" : "text-ink"
            }`}
          >
            {report.summary.critical}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Double-holds / missing blocks
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Warnings</p>
          <p
            className={`mt-1 text-3xl font-semibold ${
              report.summary.warning > 0 ? "text-amber-800" : "text-ink"
            }`}
          >
            {report.summary.warning}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Stale holds, sync, listing gaps
          </p>
        </Card>
        <Card>
          <p className="text-sm text-ink-muted">Info</p>
          <p className="mt-1 text-3xl font-semibold text-ink">
            {report.summary.info}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Hygiene / config notes</p>
        </Card>
      </div>

      {tab === "overview" ? (
        <Card className="space-y-3 border-amber-200 bg-amber-50/50">
          <h2 className="text-lg font-semibold text-stone-900">
            Residual product risk
          </h2>
          <p className="text-sm text-stone-600">
            Even with a clean scan, these platform gaps can still cause trouble
            until fixed in code:
          </p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-700">
            {report.residualRisks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tab === "system" && report.systemRows ? (
        <Card>
          <h2 className="text-lg font-semibold text-stone-900">System status</h2>
          <p className="mt-1 text-sm text-stone-500">
            Runtime signals only — secrets are never shown. Payment keys live
            under{" "}
            <Link
              href="/ops/settings"
              className="font-semibold text-bonnet hover:underline"
            >
              Platform settings
            </Link>
            .
          </p>
          <dl className="mt-4 divide-y divide-stone-100">
            {report.systemRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <dt className="text-stone-500">{row.label}</dt>
                <dd className={`font-medium ${toneClass(row.tone)}`}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {tab === "calendar" ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-stone-900">
            Calendar & booking integrity
          </h2>
          <p className="text-sm text-stone-500">
            Inventory is held by calendar blocks. Critical rows mean nights may
            be double-held or left open while a booking still exists.
          </p>
        </div>
      ) : null}

      {tab === "listings" ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-stone-900">
            Listing data health
          </h2>
          <p className="text-sm text-stone-500">
            Published stays missing photos, price, or location — plus host
            publish/domain mismatches.
          </p>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-stone-900">All findings</h2>
          <p className="text-sm text-stone-500">
            Sorted by severity. Use tabs to focus on calendar, listings, or
            system.
          </p>
        </div>
      ) : null}

      <FindingsTable
        findings={
          tab === "system"
            ? report.findings.filter(
                (f) =>
                  f.checkId === "db_ok" ||
                  f.checkId === "cron_configured" ||
                  f.checkId === "cron_in_process" ||
                  f.checkId === "ical_sync_error",
              )
            : tab === "calendar"
              ? report.findings.filter((f) =>
                  [
                    "overlap_blocks",
                    "active_booking_no_block",
                    "booking_block_orphaned",
                    "booking_dates_mismatch",
                    "stale_pending_hold",
                    "channel_overlap",
                    "ical_sync_error",
                  ].includes(f.checkId),
                )
              : tab === "listings"
                ? report.findings.filter((f) =>
                    [
                      "published_no_images",
                      "published_no_price",
                      "published_no_location",
                      "marketplace_unpublished",
                      "demo_live_mismatch",
                      "host_no_published",
                    ].includes(f.checkId),
                  )
                : report.findings
        }
      />
    </div>
  );
}
