"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DISCOUNT_DEFAULTS } from "@/lib/listing-discounts";
import { saveListingDiscounts } from "@/app/actions/properties";

type Props = {
  propertyId: string;
  initial: {
    discountNewListingPercent: number;
    discountLastMinutePercent: number;
    discountWeeklyPercent: number;
    discountMonthlyPercent: number;
  };
};

type Row = {
  key: "newListing" | "lastMinute" | "weekly" | "monthly";
  percent: number;
  title: string;
  description: string;
};

const ROWS: Row[] = [
  {
    key: "newListing",
    percent: DISCOUNT_DEFAULTS.newListing,
    title: "New listing promotion",
    description: "Help guests discover you while you build your first reviews",
  },
  {
    key: "lastMinute",
    percent: DISCOUNT_DEFAULTS.lastMinute,
    title: "Last-minute discount",
    description: "For stays booked 14 days or less before arrival",
  },
  {
    key: "weekly",
    percent: DISCOUNT_DEFAULTS.weekly,
    title: "Weekly discount",
    description: "For stays of 7 nights or more",
  },
  {
    key: "monthly",
    percent: DISCOUNT_DEFAULTS.monthly,
    title: "Monthly discount",
    description: "For stays of 28 nights or more",
  },
];

export function ListingWizardDiscountsStep({ propertyId, initial }: Props) {
  const [on, setOn] = useState({
    newListing: initial.discountNewListingPercent > 0,
    lastMinute: initial.discountLastMinutePercent > 0,
    weekly: initial.discountWeeklyPercent > 0,
    monthly: initial.discountMonthlyPercent > 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: Row["key"]) {
    setOn((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onNext() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        if (on.newListing) fd.set("newListing", "on");
        if (on.lastMinute) fd.set("lastMinute", "on");
        if (on.weekly) fd.set("weekly", "on");
        if (on.monthly) fd.set("monthly", "on");
        await saveListingDiscounts(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonnet text-sm font-bold text-white">
          S
        </span>
        <Link
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Save & exit
        </Link>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Add discounts
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Help your place stand out to get booked faster and earn your first
          reviews.
        </p>

        <div className="mt-8 space-y-3">
          {ROWS.map((row) => {
            const checked = on[row.key];
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => toggle(row.key)}
                className={[
                  "flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left transition",
                  checked
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 bg-white hover:border-stone-400",
                ].join(" ")}
              >
                <span className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-sm font-bold text-stone-900">
                  {row.percent}%
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-stone-900">
                    {row.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-stone-500">
                    {row.description}
                  </span>
                </span>
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded border-2",
                    checked
                      ? "border-bonnet bg-bonnet text-white"
                      : "border-stone-300 bg-white",
                  ].join(" ")}
                  aria-hidden
                >
                  {checked ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-stone-500">
          Only one discount will be applied per stay (the best match).
        </p>

        {error ? (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[96%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={`/admin/properties/${propertyId}/setup?step=8`}
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={onNext}
            disabled={pending}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:bg-lupine/40"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
