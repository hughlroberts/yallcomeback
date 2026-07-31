"use client";

import { useMemo, useState } from "react";
import { WhereAutocomplete } from "@/components/where-autocomplete";

type Props = {
  /** Optional extra form fields (e.g. campaign tracking). */
  hiddenFields?: Record<string, string>;
  action?: string;
  defaultWhere?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: string;
  defaultPets?: string;
  placeSuggestions?: string[];
  /** Compact variant for homepage hero */
  variant?: "page" | "hero";
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add whole days to a YYYY-MM-DD (local calendar). */
export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatYmd(d);
}

/** Nights between check-in and check-out (checkout exclusive). Min valid stay is 1. */
export function nightsBetweenYmd(checkIn: string, checkOut: string): number {
  if (!YMD.test(checkIn) || !YMD.test(checkOut)) return 0;
  const a = new Date(`${checkIn}T12:00:00`);
  const b = new Date(`${checkOut}T12:00:00`);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86400000);
}

/**
 * Optional marketplace search: Where · When · Who (guests + pets).
 * Empty fields mean no filter (anywhere / any dates / any party size).
 * When dates are used: checkout must be after check-in (minimum 1 night).
 */
export function StaySearchForm({
  hiddenFields,
  action = "/marketplace",
  defaultWhere = "",
  defaultCheckIn = "",
  defaultCheckOut = "",
  defaultGuests = "",
  defaultPets = "",
  placeSuggestions = [],
  variant = "page",
}: Props) {
  const isHero = variant === "hero";

  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(() => {
    if (
      defaultCheckIn &&
      defaultCheckOut &&
      nightsBetweenYmd(defaultCheckIn, defaultCheckOut) >= 1
    ) {
      return defaultCheckOut;
    }
    if (defaultCheckIn && YMD.test(defaultCheckIn)) {
      return addDaysYmd(defaultCheckIn, 1);
    }
    return defaultCheckOut;
  });
  const [dateError, setDateError] = useState<string | null>(null);

  const todayYmd = useMemo(() => formatYmd(new Date()), []);
  const checkoutMin = checkIn && YMD.test(checkIn) ? addDaysYmd(checkIn, 1) : todayYmd;

  function onCheckInChange(next: string) {
    setDateError(null);
    setCheckIn(next);
    if (!next) return;
    // Checkout must stay after check-in (at least one night)
    if (!checkOut || nightsBetweenYmd(next, checkOut) < 1) {
      setCheckOut(addDaysYmd(next, 1));
    }
  }

  function onCheckOutChange(next: string) {
    setDateError(null);
    setCheckOut(next);
    if (checkIn && next && nightsBetweenYmd(checkIn, next) < 1) {
      setDateError("Check-out must be after check-in (1 night minimum)");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const hasIn = Boolean(checkIn);
    const hasOut = Boolean(checkOut);

    if (!hasIn && !hasOut) {
      setDateError(null);
      return; // both empty = any dates OK
    }

    if (hasIn !== hasOut) {
      e.preventDefault();
      setDateError("Choose both check-in and check-out, or leave both blank");
      return;
    }

    const nights = nightsBetweenYmd(checkIn, checkOut);
    if (nights < 1) {
      e.preventDefault();
      setDateError("Check-out must be after check-in (1 night minimum)");
      return;
    }

    setDateError(null);
  }

  return (
    <form
      method="get"
      action={action}
      onSubmit={onSubmit}
      className={
        isHero
          ? "w-full max-w-4xl rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 sm:rounded-full sm:p-1.5"
          : "mt-8 w-full rounded-2xl border border-stone-200 bg-white p-2 shadow-sm sm:rounded-full sm:p-1.5"
      }
    >
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))
        : null}

      <div className="flex flex-col gap-1 sm:flex-row sm:items-stretch sm:gap-0 md:flex-wrap lg:flex-nowrap">
        <label className="group relative flex min-w-0 flex-1 cursor-text flex-col gap-0.5 rounded-xl px-4 py-3 hover:bg-stone-50 sm:rounded-full sm:py-2.5 md:min-w-[12rem] md:flex-[1.2]">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Where
          </span>
          <WhereAutocomplete
            name="where"
            defaultValue={defaultWhere}
            suggestions={placeSuggestions}
            placeholder="City or town"
          />
        </label>

        <div className="hidden w-px bg-stone-200 sm:block md:hidden lg:block" aria-hidden />

        <div className="grid grid-cols-2 gap-1 sm:contents">
          <label className="group flex min-w-0 flex-1 cursor-text flex-col gap-0.5 rounded-xl px-4 py-3 hover:bg-stone-50 sm:rounded-none sm:py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Check-in
            </span>
            <input
              name="checkIn"
              type="date"
              value={checkIn}
              min={todayYmd}
              onChange={(e) => onCheckInChange(e.target.value)}
              className="w-full min-w-0 border-0 bg-transparent p-0 text-base text-stone-900 outline-none sm:text-sm"
            />
          </label>

          <div className="hidden w-px bg-stone-200 sm:block md:hidden lg:block" aria-hidden />

          <label className="group flex min-w-0 flex-1 cursor-text flex-col gap-0.5 rounded-xl px-4 py-3 hover:bg-stone-50 sm:rounded-none sm:py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Check-out
            </span>
            <input
              name="checkOut"
              type="date"
              value={checkOut}
              min={checkoutMin}
              onChange={(e) => onCheckOutChange(e.target.value)}
              className="w-full min-w-0 border-0 bg-transparent p-0 text-base text-stone-900 outline-none sm:text-sm"
            />
          </label>
        </div>

        <div className="hidden w-px bg-stone-200 sm:block md:hidden lg:block" aria-hidden />

        <div className="flex min-w-0 flex-col gap-2 rounded-xl px-3 py-2 hover:bg-stone-50 sm:flex-[1.2] sm:flex-row sm:items-end sm:rounded-none sm:pr-1 md:w-full md:basis-full lg:w-auto lg:basis-auto">
          <div className="flex min-w-0 flex-1 gap-2">
            <label className="flex min-w-0 flex-1 cursor-text flex-col gap-0.5 px-1 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Guests
              </span>
              <input
                name="guests"
                type="number"
                min={1}
                max={50}
                defaultValue={defaultGuests}
                placeholder="Any"
                className="w-full min-w-0 border-0 bg-transparent p-0 text-base text-stone-900 outline-none placeholder:text-stone-400 sm:text-sm"
              />
            </label>
            <label className="flex min-w-0 flex-1 cursor-text flex-col gap-0.5 px-1 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Pets
              </span>
              <input
                name="pets"
                type="number"
                min={0}
                max={10}
                defaultValue={defaultPets}
                placeholder="0"
                className="w-full min-w-0 border-0 bg-transparent p-0 text-base text-stone-900 outline-none placeholder:text-stone-400 sm:text-sm"
              />
            </label>
          </div>
          <button
            type="submit"
            className="min-h-12 w-full shrink-0 rounded-full bg-bonnet px-6 py-3 text-sm font-semibold text-white hover:bg-bonnet-hover sm:mb-0.5 sm:min-h-0 sm:w-auto sm:py-2.5"
          >
            Search
          </button>
        </div>
      </div>

      {dateError ? (
        <p className="mt-2 px-3 text-center text-xs font-medium text-bonnet">
          {dateError}
        </p>
      ) : (
        <p className="mt-2 px-3 text-center text-xs text-stone-500">
          Dates optional. Check-out must be after check-in (1 night minimum).
          Stays with a higher minimum night stay won&apos;t appear for shorter
          trips.
        </p>
      )}
    </form>
  );
}

export { listingHrefWithSearch } from "@/lib/listing-href";
