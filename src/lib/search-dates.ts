/** Shared calendar date helpers for marketplace search. */

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function formatYmd(d: Date): string {
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

export function isYmd(s: string): boolean {
  return YMD.test(s);
}

/**
 * The calendar date where it is earliest on Earth (UTC−12). A check-in before
 * this is in the past for every guest, whatever their time zone, so servers
 * in UTC never reject "today" for someone in the Americas.
 */
export function earliestTodayYmd(now: Date = new Date()): string {
  return new Date(now.getTime() - 12 * 3600_000).toISOString().slice(0, 10);
}

/** A real calendar day in YYYY-MM-DD (rejects 2026-02-30). */
export function isValidYmd(s: string): boolean {
  if (!YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export type SearchDatesCheck =
  | { ok: true; checkIn?: string; checkOut?: string }
  | {
      ok: false;
      code: "invalid_date" | "past_dates" | "checkout_not_after_checkin";
      /** API error text. */
      error: string;
      /** Friendly line for the search page. */
      message: string;
    };

/**
 * Validate optional search dates. Missing dates are fine (any dates). Bad
 * format, a check-in already in the past, or a check-out on/before check-in
 * are errors (APIs answer 400; the search page shows `message`).
 */
export function checkSearchDates(
  checkIn: string | undefined | null,
  checkOut: string | undefined | null,
  today: string = earliestTodayYmd(),
): SearchDatesCheck {
  const ci = checkIn?.trim() || undefined;
  const co = checkOut?.trim() || undefined;
  if ((ci && !isValidYmd(ci)) || (co && !isValidYmd(co))) {
    return {
      ok: false,
      code: "invalid_date",
      error: "checkIn and checkOut must be real dates in YYYY-MM-DD format",
      message: "Those dates don't look right. Pick dates in the When calendar.",
    };
  }
  if ((ci && ci < today) || (co && co <= today && !ci)) {
    return {
      ok: false,
      code: "past_dates",
      error: `Dates are in the past. checkIn must be ${today} or later`,
      message: "Those dates have already passed. Pick dates from today on.",
    };
  }
  if (ci && co && nightsBetweenYmd(ci, co) < 1) {
    return {
      ok: false,
      code: "checkout_not_after_checkin",
      error: "checkOut must be at least one day after checkIn",
      message: "Check-out has to be after check-in (1 night minimum).",
    };
  }
  return { ok: true, checkIn: ci, checkOut: co };
}
