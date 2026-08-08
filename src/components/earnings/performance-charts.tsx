"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/utils";
import type { MonthlyBucket } from "@/lib/earnings-shared";
import { MONTH_LABELS } from "@/lib/earnings-shared";

type Props = {
  year: number;
  priorYear: number;
  current: MonthlyBucket[];
  prior: MonthlyBucket[];
  selectedMonth: number;
  monthPaid: number;
  monthUpcoming: number;
  monthTotal: number;
};

function niceMax(n: number) {
  if (n <= 0) return 400;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const m = Math.ceil(n / exp);
  return m * exp;
}

export function PerformanceCharts({
  year,
  priorYear,
  current,
  prior,
  selectedMonth: initialMonth,
  monthPaid,
  monthUpcoming,
  monthTotal,
}: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [view, setView] = useState<"bar" | "compare">("bar");
  const [showFuture, setShowFuture] = useState(true);

  const barData = useMemo(() => {
    return current.map((b) => ({
      ...b,
      value: showFuture ? b.total : b.paid,
    }));
  }, [current, showFuture]);

  const maxBar = niceMax(Math.max(...barData.map((b) => b.value), 0));
  const maxLine = niceMax(
    Math.max(
      ...current.map((b) => b.paid),
      ...prior.map((b) => b.paid),
      0,
    ),
  );

  const selected = current[month] || current[0];
  const priorSelected = prior[month] || prior[0];

  const w = 640;
  const h = 280;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 36;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  function linePath(series: number[], max: number) {
    const pts = series.map((v, i) => {
      const x = padL + (i / 11) * plotW;
      const y = padT + plotH - (v / max) * plotH;
      return `${x},${y}`;
    });
    return `M ${pts.join(" L ")}`;
  }

  const currentPaid = current.map((b) => b.paid);
  const priorPaid = prior.map((b) => b.paid);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight text-stone-900">
            Performance
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("bar")}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              view === "bar"
                ? "border-bonnet bg-bonnet text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => setView("compare")}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              view === "compare"
                ? "border-bonnet bg-bonnet text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            Comparison
          </button>
        </div>
      </div>

      {view === "bar" ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-500">Summary</p>
            <p className="text-sm text-stone-500">
              Monthly view · {year}
            </p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="mx-auto h-auto w-full max-w-3xl"
              role="img"
              aria-label={`Earnings by month for ${year}`}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padT + plotH * (1 - t);
                const val = maxBar * t;
                return (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={w - padR}
                      y1={y}
                      y2={y}
                      stroke="#e7e5e4"
                      strokeWidth={1}
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-stone-400"
                      fontSize={11}
                    >
                      {val >= 1000
                        ? `$${(val / 1000).toFixed(1)}k`
                        : `$${Math.round(val)}`}
                    </text>
                  </g>
                );
              })}
              {barData.map((b, i) => {
                const bw = plotW / 12 - 10;
                const x = padL + (i / 12) * plotW + 5;
                const bh = maxBar > 0 ? (b.value / maxBar) * plotH : 0;
                const y = padT + plotH - bh;
                const active = i === month;
                return (
                  <g key={b.label}>
                    <rect
                      x={x}
                      y={y}
                      width={bw}
                      height={Math.max(bh, 0)}
                      rx={4}
                      className="cursor-pointer"
                      fill={
                        active
                          ? "url(#barGradActive)"
                          : "url(#barGrad)"
                      }
                      onClick={() => setMonth(i)}
                    />
                    <text
                      x={x + bw / 2}
                      y={h - 12}
                      textAnchor="middle"
                      fontSize={11}
                      className={
                        active ? "fill-stone-900 font-semibold" : "fill-stone-500"
                      }
                    >
                      {b.label}
                    </text>
                  </g>
                );
              })}
              <defs>
                <linearGradient id="barGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="55%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
                <linearGradient id="barGradActive" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#1e40af" />
                  <stop offset="50%" stopColor="#1d4ed8" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50/80 p-5">
            <p className="text-sm font-semibold text-stone-900">
              {MONTH_LABELS[month]} {year}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="flex items-center gap-2 text-xl font-semibold text-stone-900">
                  <span className="inline-block size-2 rounded-[var(--radius-control)] bg-bonnet" />
                  {formatMoney(month === initialMonth ? monthPaid : selected.paid)}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">Paid</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xl font-semibold text-stone-900">
                  <span className="inline-block size-2 rounded-full bg-sky-400" />
                  {formatMoney(
                    month === initialMonth
                      ? monthUpcoming
                      : selected.upcoming,
                  )}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">Upcoming</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-stone-900">
                  {formatMoney(
                    month === initialMonth ? monthTotal : selected.total,
                  )}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">Total (USD)</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-stone-900">
              Earnings comparison{" "}
              <span className="font-normal text-stone-500">
                {year} vs. {priorYear}
              </span>
            </p>
            <div className="flex items-center gap-3 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-petal0" />
                {year}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-violet-500" />
                {priorYear}
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="mx-auto h-auto w-full max-w-3xl"
              role="img"
              aria-label="Year over year earnings"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const y = padT + plotH * (1 - t);
                const val = maxLine * t;
                return (
                  <g key={t}>
                    <line
                      x1={padL}
                      x2={w - padR}
                      y1={y}
                      y2={y}
                      stroke="#e7e5e4"
                      strokeWidth={1}
                    />
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      fontSize={11}
                      className="fill-stone-400"
                    >
                      {val >= 1000
                        ? `$${(val / 1000).toFixed(1)}k`
                        : `$${Math.round(val)}`}
                    </text>
                  </g>
                );
              })}
              <path
                d={linePath(priorPaid, maxLine)}
                fill="none"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              <path
                d={linePath(currentPaid, maxLine)}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {MONTH_LABELS.map((label, i) => {
                const x = padL + (i / 11) * plotW;
                return (
                  <text
                    key={label}
                    x={x}
                    y={h - 10}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-stone-500"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
              <p className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
                <span className="size-2 rounded-full bg-petal0" />
                {formatMoney(selected.paid)}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {MONTH_LABELS[month]} {year}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
              <p className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
                <span className="size-2 rounded-full bg-violet-500" />
                {formatMoney(priorSelected.paid)}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {MONTH_LABELS[month]} {priorYear}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
        <p>Display future earnings · Includes confirmed bookings only.</p>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <span className="text-stone-500">Show upcoming</span>
          <button
            type="button"
            role="switch"
            aria-checked={showFuture}
            onClick={() => setShowFuture((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition ${
              showFuture ? "bg-bonnet" : "bg-stone-300"
            }`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${
                showFuture ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  );
}
