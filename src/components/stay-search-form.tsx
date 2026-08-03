"use client";

import { useMemo, useState } from "react";
import { WhereAutocomplete } from "@/components/where-autocomplete";
import { SearchDateRangePicker } from "@/components/search-date-range-picker";
import {
  addDaysYmd,
  formatYmd,
  isYmd,
  nightsBetweenYmd,
} from "@/lib/search-dates";

export { addDaysYmd, nightsBetweenYmd } from "@/lib/search-dates";

type Props = {
  /** Optional extra form fields (e.g. campaign tracking). */
  hiddenFields?: Record<string, string>;
  action?: string;
  defaultWhere?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: string;
  defaultPets?: string;
  /** ± days flexibility (0 = exact) */
  defaultDateFlex?: string | number;
  placeSuggestions?: string[];
  /** Compact variant for homepage hero */
  variant?: "page" | "hero";
};

function parseFlex(raw: string | number | undefined): number {
  if (raw === undefined || raw === "") return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const allowed = [1, 2, 3, 7, 14];
  return allowed.includes(Math.floor(n)) ? Math.floor(n) : 0;
}

/**
 * Optional marketplace search: Where · When · Who (guests + pets).
 * Empty fields mean no filter (anywhere / any dates / any party size).
 * When dates are used: checkout must be after check-in (minimum 1 night).
 * dateFlex loosens the window (± days) like Airbnb.
 */
export function StaySearchForm({
  hiddenFields,
  action = "/marketplace",
  defaultWhere = "",
  defaultCheckIn = "",
  defaultCheckOut = "",
  defaultGuests = "",
  defaultPets = "",
  defaultDateFlex = "",
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
    return defaultCheckOut && isYmd(defaultCheckOut) ? defaultCheckOut : "";
  });
  const [dateFlex, setDateFlex] = useState(() => parseFlex(defaultDateFlex));
  const [dateError, setDateError] = useState<string | null>(null);

  const todayYmd = useMemo(() => formatYmd(new Date()), []);

  function onDatesChange(next: {
    checkIn: string;
    checkOut: string;
    dateFlex: number;
  }) {
    setDateError(null);
    setCheckIn(next.checkIn);
    setCheckOut(next.checkOut);
    setDateFlex(next.dateFlex);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const hasIn = Boolean(checkIn);
    const hasOut = Boolean(checkOut);

    if (!hasIn && !hasOut) {
      setDateError(null);
      return; // flexible / any dates
    }

    if (hasIn !== hasOut) {
      e.preventDefault();
      setDateError("Choose check-in and check-out in the When calendar, or clear dates");
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

        <SearchDateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          dateFlex={dateFlex}
          onChange={onDatesChange}
          minDate={todayYmd}
          className="sm:flex-[1.35]"
        />

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
          Dates optional — use Flexible to browse any stay. With dates, pick
          check-in then check-out in one calendar; add ± days if you can flex.
        </p>
      )}
    </form>
  );
}

export { listingHrefWithSearch } from "@/lib/listing-href";
