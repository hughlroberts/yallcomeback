import Link from "next/link";
import type { FlexibleDates } from "@/lib/flexible-dates";

/**
 * "More stays with flexible dates" — shown on /marketplace when exact dates
 * return few stays and a nearby window (or a stay long enough for a minimum)
 * has more. Chips link to the same search with those dates.
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
