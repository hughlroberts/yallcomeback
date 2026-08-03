"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  InsightsDayPoint,
  InsightsListingOption,
  ListingInsights,
} from "@/lib/listing-insights";

type Props = {
  /** Property this admin page is for (always included in selection by default) */
  currentPropertyId: string;
  hostListings: InsightsListingOption[];
  initial: ListingInsights;
};

/**
 * Airbnb-style Views / Insights: multi-select listings, KPI cards, sparkline chart.
 */
export function AdminListingInsights({
  currentPropertyId,
  hostListings,
  initial,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(() =>
    initial.propertyIds.length
      ? initial.propertyIds
      : [currentPropertyId],
  );
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const selectedListings = useMemo(
    () => hostListings.filter((l) => selected.includes(l.id)),
    [hostListings, selected],
  );

  const headline =
    selectedListings.length === 0
      ? "No listings selected"
      : selectedListings.length === 1
        ? selectedListings[0].title
        : `${selectedListings.length} listings`;

  async function applySelection(ids: string[]) {
    const next = ids.length ? ids : [currentPropertyId];
    setSelected(next);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ids: next.join(","),
        days: String(initial.days || 30),
      });
      const res = await fetch(`/api/admin/listing-insights?${qs}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = (await res.json()) as ListingInsights;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleId(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next.length ? next : prev; // keep at least one
      }
      return [...prev, id];
    });
  }

  function selectOnly(id: string) {
    void applySelection([id]);
    setOpen(false);
    if (id !== currentPropertyId) {
      router.push(`/admin/properties/${id}?tab=insights`);
    }
  }

  const maxViews = Math.max(1, ...data.series.map((s) => s.views));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
          Insights
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          How guests find and book your stays — last {data.days} days.
        </p>
      </div>

      {/* Listing multi-select (Airbnb-style) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm hover:border-stone-300"
          aria-expanded={open}
        >
          {selectedListings[0]?.imageUrl ? (
            <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-stone-100">
              <Image
                src={selectedListings[0].imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
                unoptimized
              />
            </span>
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-sm font-semibold text-stone-500">
              {selectedListings.length || "·"}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-stone-900">
              {headline}
            </span>
            <span className="text-xs text-stone-500">
              {selectedListings.length === 1
                ? "1 listing"
                : `${selectedListings.length} listings`}
              {" · "}
              Multi-select to combine stats
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-stone-400 transition",
              open && "rotate-180",
            )}
          />
        </button>

        {open ? (
          <div className="absolute z-30 mt-2 w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
            <div className="max-h-72 overflow-y-auto py-1">
              {hostListings.map((l) => {
                const checked = selected.includes(l.id);
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleId(l.id)}
                        className="size-4 rounded border-stone-300"
                      />
                      {l.imageUrl ? (
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                          <Image
                            src={l.imageUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="40px"
                            unoptimized
                          />
                        </span>
                      ) : (
                        <span className="size-10 shrink-0 rounded-lg bg-stone-100" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-stone-900">
                          {l.title}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          {l.published ? "Published" : "Draft"}
                        </span>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-bonnet hover:underline"
                      onClick={() => selectOnly(l.id)}
                    >
                      Open
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 px-3 py-2.5">
              <button
                type="button"
                className="text-xs font-semibold text-stone-600 hover:underline"
                onClick={() =>
                  setSelected(hostListings.map((l) => l.id))
                }
              >
                Select all
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full bg-bonnet px-4 py-1.5 text-xs font-semibold text-white hover:bg-bonnet-hover"
                  onClick={() => {
                    void applySelection(selected);
                    setOpen(false);
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* KPI row */}
      <div
        className={cn(
          "grid gap-6 sm:grid-cols-3",
          loading && "opacity-60",
        )}
      >
        <Kpi
          value={String(data.views)}
          label={`Views, past ${data.days} days`}
        />
        <Kpi
          value={String(data.newBookings)}
          label={`New bookings, past ${data.days} days`}
        />
        <Kpi
          value={`${data.bookingRatePercent}%`}
          label="Booking rate"
          tip="New bookings ÷ listing views in this period"
        />
      </div>

      {/* Chart */}
      <div className={cn("rounded-2xl border border-stone-100 bg-white p-4 sm:p-6", loading && "opacity-60")}>
        <ViewsChart series={data.series} maxViews={maxViews} />
        <p className="mt-3 text-xs text-stone-400">
          {data.rangeStart} → {data.rangeEnd} · Views may lag slightly after
          guests open a listing
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 px-5 py-6">
        <h3 className="text-base font-semibold text-stone-900">
          Grow your views
        </h3>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-stone-600">
          <li>Publish the listing and keep the calendar open for peak weekends.</li>
          <li>
            Share your marketplace link or host site; every guest open counts as
            a view.
          </li>
          <li>
            <Link
              href="/admin/earnings/performance"
              className="font-medium text-bonnet hover:underline"
            >
              Earnings → Performance
            </Link>{" "}
            for revenue over time.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({
  value,
  label,
  tip,
}: {
  value: string;
  label: string;
  tip?: string;
}) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
        {value}
      </p>
      <p className="mt-1 text-sm text-stone-500" title={tip}>
        {label}
        {tip ? (
          <span className="ml-1 cursor-help text-stone-400" title={tip}>
            ⓘ
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ViewsChart({
  series,
  maxViews,
}: {
  series: InsightsDayPoint[];
  maxViews: number;
}) {
  const w = 720;
  const h = 220;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = Math.max(1, series.length - 1);

  const points = series.map((s, i) => {
    const x = padL + (i / n) * plotW;
    const y = padT + plotH - (s.views / maxViews) * plotH;
    return { x, y, ...s };
  });

  const line =
    points.length > 0
      ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`
      : "";

  const area =
    points.length > 0
      ? `${line} L ${points[points.length - 1].x},${padT + plotH} L ${points[0].x},${padT + plotH} Z`
      : "";

  // sparse x labels
  const labelIdx = new Set<number>();
  const step = Math.max(1, Math.floor(series.length / 6));
  for (let i = 0; i < series.length; i += step) labelIdx.add(i);
  labelIdx.add(series.length - 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full min-w-[280px] text-bonnet"
        role="img"
        aria-label="Listing views over time"
      >
        {/* grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padT + plotH * (1 - t);
          return (
            <line
              key={t}
              x1={padL}
              x2={w - padR}
              y1={y}
              y2={y}
              stroke="#f5f5f4"
              strokeWidth={1}
            />
          );
        })}
        <path d={area} fill="currentColor" opacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p) => (
          <circle
            key={p.day}
            cx={p.x}
            cy={p.y}
            r={p.views > 0 ? 3.5 : 2}
            fill="currentColor"
            className="opacity-90"
          />
        ))}
        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text
              key={`l-${p.day}`}
              x={p.x}
              y={h - 8}
              textAnchor="middle"
              className="fill-stone-400"
              style={{ fontSize: 10 }}
            >
              {p.label.replace(/ .*/, "") /* day num-ish from "Jul 4" */}
              {` ${p.day.slice(8)}`}
            </text>
          ) : null,
        )}
        <text
          x={padL - 8}
          y={padT + 4}
          textAnchor="end"
          className="fill-stone-400"
          style={{ fontSize: 10 }}
        >
          {maxViews}
        </text>
        <text
          x={padL - 8}
          y={padT + plotH}
          textAnchor="end"
          className="fill-stone-400"
          style={{ fontSize: 10 }}
        >
          0
        </text>
      </svg>
    </div>
  );
}
