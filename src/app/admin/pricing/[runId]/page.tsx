import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import {
  applyPricingRecommendation,
  decidePricingRecommendation,
} from "@/app/actions/pricing-intelligence";
import { Button, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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
  }>;
}) {
  if (!isPricingIntelligenceEnabled()) {
    redirect("/admin/pricing");
  }

  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const { runId } = await params;
  const sp = await searchParams;

  const run = await prisma.pricingIntelligenceRun.findUnique({
    where: { id: runId },
    include: {
      host: { select: { id: true, name: true, slug: true } },
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
            },
          },
        },
      },
    },
  });
  if (!run) notFound();
  if (!access.isPlatform && access.hostId !== run.hostId) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">
          <Link href="/admin/pricing" className="font-medium text-bonnet hover:underline">
            ← Pricing intelligence
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-stone-900">
          {run.host.name}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {run.status} · {run.trigger} ·{" "}
          {run.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
        </p>
      </div>

      {sp.started ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Research complete
          {sp.n ? ` — ${sp.n} actionable suggestion(s).` : "."} Review below.
        </p>
      ) : null}
      {sp.decided ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Decision saved.
        </p>
      ) : null}
      {sp.applied ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Base nightly rate updated on the listing.
        </p>
      ) : null}
      {sp.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {sp.error}
        </p>
      ) : null}
      {run.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Run error: {run.error}
        </p>
      ) : null}

      {run.reportMarkdown ? (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-stone-900">Report</h2>
          <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-4 text-xs leading-relaxed text-stone-700">
            {run.reportMarkdown}
          </pre>
        </Card>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">
          Recommendations
        </h2>
        {run.recommendations.length === 0 ? (
          <p className="text-sm text-stone-500">No recommendations on this run.</p>
        ) : (
          run.recommendations.map((rec) => {
            const up = rec.changePercent > 0;
            const flat = rec.changePercent === 0 || rec.status === "SKIPPED";
            return (
              <Card key={rec.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/admin/properties/${rec.property.id}`}
                      className="font-semibold text-stone-900 hover:underline"
                    >
                      {rec.property.title}
                    </Link>
                    <p className="text-xs text-stone-500">
                      Sleeps {rec.property.maxGuests}
                      {rec.property.bedrooms
                        ? ` · ${rec.property.bedrooms} bed`
                        : ""}
                      {rec.property.city ? ` · ${rec.property.city}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      rec.status === "PENDING" && "bg-amber-100 text-amber-900",
                      rec.status === "APPROVED" && "bg-petal text-bonnet",
                      rec.status === "APPLIED" && "bg-emerald-100 text-emerald-900",
                      rec.status === "REJECTED" && "bg-stone-200 text-stone-600",
                      rec.status === "SKIPPED" && "bg-stone-100 text-stone-500",
                    )}
                  >
                    {rec.status}
                  </span>
                </div>

                <p className="text-sm text-stone-800">
                  <span className="tabular-nums">
                    {formatMoney(rec.currentNightlyRate)}
                  </span>
                  {" → "}
                  <span className="font-semibold tabular-nums">
                    {formatMoney(rec.suggestedNightlyRate)}
                  </span>
                  <span
                    className={cn(
                      "ml-2 text-sm font-medium",
                      flat && "text-stone-500",
                      !flat && up && "text-emerald-700",
                      !flat && !up && "text-amber-800",
                    )}
                  >
                    {flat
                      ? "hold"
                      : `${rec.changePercent > 0 ? "+" : ""}${rec.changePercent}%`}
                  </span>
                  <span className="ml-2 text-xs text-stone-400">
                    {rec.basis} · {(rec.confidence * 100).toFixed(0)}% conf.
                  </span>
                </p>

                <p className="text-sm leading-relaxed text-stone-600">
                  {rec.rationale}
                </p>
                {rec.experimentNote ? (
                  <p className="text-xs leading-relaxed text-stone-500">
                    <strong className="text-stone-700">Experiment:</strong>{" "}
                    {rec.experimentNote}
                  </p>
                ) : null}
                {rec.projectedImpact ? (
                  <p className="text-xs leading-relaxed text-stone-500">
                    <strong className="text-stone-700">Impact:</strong>{" "}
                    {rec.projectedImpact}
                  </p>
                ) : null}
                {rec.riskNotes ? (
                  <p className="text-xs leading-relaxed text-stone-500">
                    <strong className="text-stone-700">Risks:</strong>{" "}
                    {rec.riskNotes}
                  </p>
                ) : null}

                {rec.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <form action={decidePricingRecommendation}>
                      <input type="hidden" name="id" value={rec.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <Button type="submit" className="!py-2">
                        Approve
                      </Button>
                    </form>
                    <form action={decidePricingRecommendation}>
                      <input type="hidden" name="id" value={rec.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <Button type="submit" variant="secondary" className="!py-2">
                        Reject
                      </Button>
                    </form>
                  </div>
                ) : null}

                {rec.status === "APPROVED" ? (
                  <form action={applyPricingRecommendation} className="pt-1">
                    <input type="hidden" name="id" value={rec.id} />
                    <Button type="submit" className="!py-2">
                      Apply to listing base rate
                    </Button>
                    <p className="mt-1 text-xs text-stone-500">
                      Writes{" "}
                      <code className="rounded bg-stone-100 px-1">
                        baseNightlyRate
                      </code>{" "}
                      only. Seasons and weekends are unchanged.
                    </p>
                  </form>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
