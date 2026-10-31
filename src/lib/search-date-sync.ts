import { isYmd, nightsBetweenYmd } from "@/lib/search-dates";

/**
 * Keeps the search form's When field in step with the URL.
 *
 * A flexible-date chip is a soft navigation: the new page arrives a moment
 * later, so the chip also announces its dates and the form shows them at once.
 * The marketplace page keys the form on the search params, so after the
 * navigation every field remounts from the new URL.
 */
export const SEARCH_DATES_EVENT = "ycb:search-dates";

export type SearchDates = {
  checkIn: string;
  checkOut: string;
  dateFlex: number;
};

export function announceSearchDates(
  target: EventTarget,
  dates: SearchDates,
): void {
  target.dispatchEvent(new CustomEvent(SEARCH_DATES_EVENT, { detail: dates }));
}

/** Dates from an announce event, or null if they are not a valid stay. */
export function searchDatesFromEvent(e: Event): SearchDates | null {
  const d = (e as CustomEvent<Partial<SearchDates> | undefined>).detail;
  if (!d || typeof d.checkIn !== "string" || typeof d.checkOut !== "string") {
    return null;
  }
  if (!isYmd(d.checkIn) || !isYmd(d.checkOut)) return null;
  if (nightsBetweenYmd(d.checkIn, d.checkOut) < 1) return null;
  const flex = Number(d.dateFlex ?? 0);
  return {
    checkIn: d.checkIn,
    checkOut: d.checkOut,
    dateFlex: Number.isFinite(flex) && flex > 0 ? Math.floor(flex) : 0,
  };
}

/** React key for the search form: changes whenever a field's URL value does. */
export function searchFormKey(
  fields: Record<string, string | number | null | undefined>,
): string {
  return Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k] ?? ""}`)
    .join("&");
}
