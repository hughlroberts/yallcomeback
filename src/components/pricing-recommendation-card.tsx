import Link from "next/link";
import {
  applyPricingRecommendation,
  decidePricingRecommendation,
} from "@/app/actions/pricing-intelligence";
import { Button } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";

export type PricingRecCardData = {
  id: string;
  status: string;
  currentNightlyRate: number;
  suggestedNightlyRate: number;
  changePercent: number;
  basis: string;
  confidence: number;
  rationale: string;
  experimentNote: string | null;
  projectedImpact: string | null;
  riskNotes: string | null;
  evidenceJson: string;
  property: {
    id: string;
    title: string;
    slug: string;
    maxGuests: number;
    bedrooms: number;
    city: string | null;
    images?: { url: string }[];
  };
};

type Peer = {
  title?: string;
  maxGuests?: number;
  rate?: number;
  city?: string | null;
  region?: string | null;
};

function parseEvidence(json: string): {
  peers?: Peer[];
  peerMedian?: number | null;
  peerCount?: number;
  occupancyEstimate90d?: number;
  bookingCount90d?: number;
  maxGuests?: number;
} {
  try {
    return JSON.parse(json) as {
      peers?: Peer[];
      peerMedian?: number | null;
      peerCount?: number;
      occupancyEstimate90d?: number;
      bookingCount90d?: number;
      maxGuests?: number;
    };
  } catch {
    return {};
  }
}

function basisLabel(basis: string): string {
  switch (basis) {
    case "CAPACITY":
      return "Capacity match";
    case "OCCUPANCY":
      return "Occupancy";
    case "SEASONALITY":
      return "Seasonality";
    case "COMPETITIVE":
      return "Competitive";
    case "MIXED":
      return "Mixed signals";
    default:
      return basis;
  }
}

function statusTone(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "APPROVED":
      return "bg-petal text-bonnet ring-bonnet/20";
    case "APPLIED":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    case "REJECTED":
      return "bg-stone-100 text-stone-600 ring-stone-200";
    case "SKIPPED":
      return "bg-stone-50 text-stone-500 ring-stone-200";
    default:
      return "bg-stone-50 text-stone-600 ring-stone-200";
  }
}

/**
 * Visual card for one market-research price suggestion.
 * Emphasizes before → after rate, capacity basis, and approve/apply steps.
 */
export function PricingRecommendationCard({ rec }: { rec: PricingRecCardData }) {
  const up = rec.changePercent > 0;
  const flat = rec.changePercent === 0 || rec.status === "SKIPPED";
  const evidence = parseEvidence(rec.evidenceJson);
  const peers = evidence.peers || [];
  const cover = rec.property.images?.[0]?.url;
  const confPct = Math.round(Math.min(1, Math.max(0, rec.confidence)) * 100);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-3xl border bg-white shadow-sm",
        rec.status === "PENDING" && "border-amber-200/80 ring-1 ring-amber-100",
        rec.status === "APPROVED" && "border-bonnet/25 ring-1 ring-bonnet/10",
        rec.status === "APPLIED" && "border-emerald-200",
        (rec.status === "REJECTED" || rec.status === "SKIPPED") &&
          "border-stone-200 opacity-90",
      )}
    >
      {/* Top: listing identity + status */}
      <div className="flex gap-4 border-b border-stone-100 p-4 sm:p-5">
        <div className="relative hidden h-20 w-24 shrink-0 overflow-hidden rounded-2xl bg-stone-100 sm:block">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-400">
              Stay
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/admin/properties/${rec.property.id}`}
                className="font-semibold text-stone-900 hover:underline"
              >
                {rec.property.title}
              </Link>
              <p className="mt-0.5 text-xs text-stone-500">
                Sleeps {rec.property.maxGuests}
                {rec.property.bedrooms
                  ? ` · ${rec.property.bedrooms} bed`
                  : ""}
                {rec.property.city ? ` · ${rec.property.city}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                statusTone(rec.status),
              )}
            >
              {rec.status === "SKIPPED" ? "Hold / no change" : rec.status}
            </span>
          </div>

          {/* Before → After price hero */}
          <div className="mt-4 flex flex-wrap items-end gap-3 sm:gap-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Current
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-stone-500 line-through decoration-stone-300 sm:text-2xl">
                {formatMoney(rec.currentNightlyRate)}
              </p>
              <p className="text-[11px] text-stone-400">/ night base</p>
            </div>
            <div
              className={cn(
                "mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                flat && "bg-stone-100 text-stone-500",
                !flat && up && "bg-emerald-100 text-emerald-800",
                !flat && !up && "bg-amber-100 text-amber-900",
              )}
              aria-hidden
            >
              {flat ? "·" : up ? "↑" : "↓"}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Suggested
              </p>
              <p
                className={cn(
                  "mt-0.5 text-2xl font-semibold tabular-nums sm:text-3xl",
                  flat && "text-stone-800",
                  !flat && up && "text-emerald-800",
                  !flat && !up && "text-amber-950",
                )}
              >
                {formatMoney(rec.suggestedNightlyRate)}
              </p>
              <p className="text-[11px] text-stone-400">/ night base</p>
            </div>
            <div className="ml-auto self-center">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
                  flat && "bg-stone-100 text-stone-600",
                  !flat && up && "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
                  !flat &&
                    !up &&
                    "bg-amber-50 text-amber-950 ring-1 ring-amber-200",
                )}
              >
                {flat
                  ? "No change"
                  : `${rec.changePercent > 0 ? "+" : ""}${rec.changePercent}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Meta chips + confidence */}
      <div className="space-y-3 border-b border-stone-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-bonnet/10 px-2.5 py-0.5 text-[11px] font-semibold text-bonnet">
            {basisLabel(rec.basis)}
          </span>
          {evidence.peerMedian != null ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
              Peer median {formatMoney(evidence.peerMedian)}
            </span>
          ) : null}
          {typeof evidence.bookingCount90d === "number" ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
              {evidence.bookingCount90d} bookings (window)
            </span>
          ) : null}
          {typeof evidence.occupancyEstimate90d === "number" ? (
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
              ~{(evidence.occupancyEstimate90d * 100).toFixed(0)}% occ. est.
            </span>
          ) : null}
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] text-stone-500">
            <span>Confidence</span>
            <span className="font-semibold tabular-nums text-stone-700">
              {confPct}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                confPct >= 70
                  ? "bg-emerald-500"
                  : confPct >= 45
                    ? "bg-bonnet"
                    : "bg-amber-400",
              )}
              style={{ width: `${confPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Rationale blocks */}
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
            Why this rate
          </p>
          <p className="mt-1 text-sm leading-relaxed text-stone-700">
            {rec.rationale}
          </p>
        </div>

        {peers.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              Capacity-matched comps (sleeps ~{rec.property.maxGuests})
            </p>
            <div className="mt-2 overflow-hidden rounded-xl border border-stone-100">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Peer stay</th>
                    <th className="px-3 py-2 font-medium">Sleeps</th>
                    <th className="px-3 py-2 font-medium text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {peers.slice(0, 5).map((p, i) => (
                    <tr key={i} className="text-stone-700">
                      <td className="max-w-[10rem] truncate px-3 py-2 sm:max-w-none">
                        {p.title || "Peer"}
                        {p.city ? (
                          <span className="text-stone-400"> · {p.city}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {p.maxGuests ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {typeof p.rate === "number"
                          ? formatMoney(p.rate)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {rec.experimentNote ? (
            <div className="rounded-2xl bg-petal/60 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-bonnet">
                Suggested test
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-700">
                {rec.experimentNote}
              </p>
            </div>
          ) : null}
          {rec.projectedImpact ? (
            <div className="rounded-2xl bg-stone-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                Projected impact
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-700">
                {rec.projectedImpact}
              </p>
            </div>
          ) : null}
        </div>

        {rec.riskNotes ? (
          <p className="text-xs leading-relaxed text-stone-500">
            <span className="font-semibold text-stone-600">Risks:</span>{" "}
            {rec.riskNotes}
          </p>
        ) : null}
      </div>

      {/* Actions */}
      <div className="border-t border-stone-100 bg-stone-50/80 px-4 py-3 sm:px-5">
        {rec.status === "PENDING" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-500">
              Step 1 of 2 — Approve only moves you to apply. Nothing changes on
              the live listing yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={decidePricingRecommendation}>
                <input type="hidden" name="id" value={rec.id} />
                <input type="hidden" name="decision" value="reject" />
                <Button type="submit" variant="secondary" className="!py-2 !text-xs">
                  Reject
                </Button>
              </form>
              <form action={decidePricingRecommendation}>
                <input type="hidden" name="id" value={rec.id} />
                <input type="hidden" name="decision" value="approve" />
                <Button type="submit" className="!py-2 !text-xs">
                  Approve suggestion
                </Button>
              </form>
            </div>
          </div>
        ) : null}

        {rec.status === "APPROVED" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-stone-500">
              Step 2 of 2 — Apply writes base nightly rate only (seasons /
              weekend premium stay as set).
            </p>
            <form action={applyPricingRecommendation}>
              <input type="hidden" name="id" value={rec.id} />
              <Button type="submit" className="!py-2 !text-xs">
                Apply {formatMoney(rec.suggestedNightlyRate)}/night
              </Button>
            </form>
          </div>
        ) : null}

        {rec.status === "APPLIED" ? (
          <p className="text-xs font-medium text-emerald-800">
            Applied to listing base rate.{" "}
            <Link
              href={`/admin/properties/${rec.property.id}`}
              className="underline underline-offset-2"
            >
              Open listing
            </Link>
          </p>
        ) : null}

        {rec.status === "REJECTED" ? (
          <p className="text-xs text-stone-500">Rejected — no rate change.</p>
        ) : null}

        {rec.status === "SKIPPED" ? (
          <p className="text-xs text-stone-500">
            Model recommends holding the current rate this cycle.
          </p>
        ) : null}
      </div>
    </article>
  );
}
