import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import { PricingRecommendationCard } from "@/components/pricing-recommendation-card";
import { Card } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Research run · Pricing" };

export default async function AdminPricingRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{
    started?: string;
    decided?: string;
    applied?: string;
    error?: string;
    n?: string;
    view?: string;
  }>;
}) {
  if (!isPricingIntelligenceEnabled()) {
    redirect("/admin/pricing");
  }

  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  if (!access.isPlatform && access.hostId) {
    const gate = await prisma.host.findUnique({
      where: { id: access.hostId },
      select: { pricingIntelligenceEnabled: true },
    });
    if (!gate?.pricingIntelligenceEnabled) {
      redirect("/admin");
    }
  }

  const { runId } = await params;
  const sp = await searchParams;

  const run = await prisma.pricingIntelligenceRun.findUnique({
    where: { id: runId },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          slug: true,
          pricingIntelligenceEnabled: true,
        },
      },
      recommendations: {
        orderBy: [{ status: "asc" }, { changePercent: "desc" }],
        include: {
          property: {
            select: {
              id: true,
              title: true,
              slug: true,
              maxGuests: true,
              bedrooms: true,
              city: true,
              images: {
                orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
    },
  });
  if (!run) notFound();
  if (!access.isPlatform && access.hostId !== run.hostId) notFound();

  const recs = run.recommendations;
  const pending = recs.filter((r) => r.status === "PENDING");
  const raises = recs.filter(
    (r) => r.status !== "SKIPPED" && r.changePercent > 0,
  );
  const lowers = recs.filter(
    (r) => r.status !== "SKIPPED" && r.changePercent < 0,
  );
  const holds = recs.filter(
    (r) => r.status === "SKIPPED" || r.changePercent === 0,
  );
  const approved = recs.filter((r) => r.status === "APPROVED");
  const applied = recs.filter((r) => r.status === "APPLIED");

  // Default: actionable when something needs a decision; otherwise all
  // (so hold-only first runs still show cards instead of an empty list).
  const defaultView =
    pending.length + approved.length > 0 ? "actionable" : "all";
  const view = sp.view || defaultView;

  const filtered =
    view === "all"
      ? recs
      : view === "raises"
        ? raises
        : view === "lowers"
          ? lowers
          : view === "holds"
            ? holds
            : view === "pending"
              ? pending
              : // actionable = pending + approved (needs host attention)
                recs.filter(
                  (r) => r.status === "PENDING" || r.status === "APPROVED",
                );

  const periodLabel = `${run.periodStart.toISOString().slice(0, 10)} → ${run.periodEnd.toISOString().slice(0, 10)}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-stone-500">
          <Link
            href="/admin/pricing"
            className="font-medium text-bonnet hover:underline"
          >
            ← Pricing intelligence
          </Link>
        </p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight text-stone-900 sm:text-3xl">
          Research results
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {run.host.name} · {periodLabel} ·{" "}
          {run.trigger === "MONTHLY_CRON" ? "Monthly run" : "Manual run"} ·{" "}
          {run.status.toLowerCase()}
        </p>
      </div>

      {/* Flash */}
      {sp.started ? (
        <Banner tone="ok">
          Research complete
          {sp.n ? ` — ${sp.n} actionable suggestion(s).` : "."} Review cards
          below; nothing is live until you approve and apply.
        </Banner>
      ) : null}
      {sp.decided ? <Banner tone="ok">Decision saved.</Banner> : null}
      {sp.applied ? (
        <Banner tone="ok">Base nightly rate updated on the listing.</Banner>
      ) : null}
      {sp.error ? <Banner tone="warn">{sp.error}</Banner> : null}
      {run.error ? <Banner tone="err">Run error: {run.error}</Banner> : null}

      {/* How to use this run */}
      <Card className="border-bonnet/15 bg-gradient-to-br from-petal/80 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
          How to use this research
        </p>
        <ol className="mt-2 grid gap-2 text-sm text-stone-700 sm:grid-cols-3">
          <li className="rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-stone-100">
            <span className="font-semibold text-stone-900">1. Compare</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Suggested vs current. Fair comps match capacity{" "}
              <em>and</em> location quality (waterfront ≠ inland; pool matters).
            </span>
          </li>
          <li className="rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-stone-100">
            <span className="font-semibold text-stone-900">2. Approve / reject</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Tag why (wrong comps, location mismatch). Feedback improves next
              month. No live price change yet.
            </span>
          </li>
          <li className="rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-stone-100">
            <span className="font-semibold text-stone-900">3. Apply</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Writes base nightly rate only. Seasons and weekend premium stay as
              set.
            </span>
          </li>
        </ol>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Needs review"
          value={String(pending.length)}
          hint="Awaiting approve/reject"
          accent={pending.length > 0 ? "amber" : "muted"}
        />
        <Stat
          label="Raise"
          value={String(raises.length)}
          hint="Suggested higher rate"
          accent="up"
        />
        <Stat
          label="Lower"
          value={String(lowers.length)}
          hint="Suggested lower rate"
          accent="down"
        />
        <Stat
          label="Hold"
          value={String(holds.length)}
          hint="No change this cycle"
          accent="muted"
        />
      </div>

      {(approved.length > 0 || applied.length > 0) ? (
        <p className="text-xs text-stone-500">
          {approved.length > 0 ? (
            <span className="mr-3">
              <strong className="text-bonnet">{approved.length}</strong> approved
              — ready to apply
            </span>
          ) : null}
          {applied.length > 0 ? (
            <span>
              <strong className="text-emerald-800">{applied.length}</strong>{" "}
              already applied
            </span>
          ) : null}
        </p>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["actionable", "Needs action", pending.length + approved.length],
            ["pending", "Pending", pending.length],
            ["raises", "Raises", raises.length],
            ["lowers", "Lowers", lowers.length],
            ["holds", "Holds", holds.length],
            ["all", "All", recs.length],
          ] as const
        ).map(([key, label, count]) => (
          <Link
            key={key}
            href={`/admin/pricing/${runId}?view=${key}`}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              view === key
                ? "bg-bonnet text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            {label}
            <span className="ml-1 tabular-nums opacity-80">{count}</span>
          </Link>
        ))}
      </div>

      {/* Recommendation cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-stone-500">
            Nothing in this filter. Try{" "}
            <Link
              href={`/admin/pricing/${runId}?view=all`}
              className="font-semibold text-bonnet hover:underline"
            >
              All
            </Link>
            .
          </Card>
        ) : (
          filtered.map((rec) => (
            <PricingRecommendationCard key={rec.id} rec={rec} />
          ))
        )}
      </div>

      {/* Full report (secondary) */}
      {run.reportMarkdown ? (
        <details className="group rounded-3xl border border-stone-200 bg-white shadow-sm">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-stone-900 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              Full research report
              <span className="text-xs font-medium text-stone-400 group-open:hidden">
                Show
              </span>
              <span className="hidden text-xs font-medium text-stone-400 group-open:inline">
                Hide
              </span>
            </span>
            <p className="mt-0.5 text-xs font-normal text-stone-500">
              Method notes, external brief, and long-form write-up for this run.
            </p>
          </summary>
          <pre className="max-h-[32rem] overflow-auto border-t border-stone-100 bg-stone-50/80 px-5 py-4 text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">
            {run.reportMarkdown}
          </pre>
        </details>
      ) : null}

      <p className="text-center text-xs text-stone-400">
        Add-on product · rates shown as {formatMoney(100)} style base nightly.
        Weekend and seasonal rules are separate.
      </p>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "err";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "ok" &&
          "border-emerald-200 bg-emerald-50 text-emerald-950",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-950",
        tone === "err" && "border-red-200 bg-red-50 text-red-900",
      )}
    >
      {children}
    </p>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "amber" | "up" | "down" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        accent === "amber" && "border-amber-200 bg-amber-50/80",
        accent === "up" && "border-emerald-100 bg-emerald-50/50",
        accent === "down" && "border-amber-100 bg-amber-50/40",
        accent === "muted" && "border-stone-200 bg-white",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      <p className="text-[11px] text-stone-500">{hint}</p>
    </div>
  );
}
