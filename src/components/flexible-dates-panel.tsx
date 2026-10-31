"use client";

import Link from "next/link";
import type { FlexibleDates } from "@/lib/flexible-dates";
import { announceSearchDates } from "@/lib/search-date-sync";

/**
 * "More stays with flexible dates" — shown on /marketplace when exact dates
 * return few stays and a nearby window (or a stay long enough for a minimum)
 * has more. Chips link to the same search with those dates, and tell the
 * search form right away so the When field never shows the old dates.
 */
export function FlexibleDatesPanel({
  flexibleDates,
  className = "",
}: {
  flexibleDates: FlexibleDates | null;
  className?: string;
}) {
  if (!flexibleDates || flexibleDates.suggestions.length === 0) return null;
  const { suggestions, minStay } = flexibleDates;
  return (
    <section
      aria-labelledby="flexible-dates-heading"
      className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 ${className}`}
    >
      <h2
        id="flexible-dates-heading"
        className="text-sm font-semibold text-slate-800"
      >
        More stays with flexible dates
      </h2>
      {minStay ? (
        <p className="mt-1 text-sm text-slate-500">{minStay.message}</p>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <li key={`${s.checkIn}-${s.checkOut}`}>
            <Link
              href={s.searchPath}
              onClick={(e) => {
                // New tab / window: this page's form keeps its dates.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                if (e.button !== 0) return;
                announceSearchDates(window, {
                  checkIn: s.checkIn,
                  checkOut: s.checkOut,
                  dateFlex: 0,
                });
              }}
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-bonnet hover:text-bonnet"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
