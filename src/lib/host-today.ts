/**
 * "Today" for host calendars, computed in the marketplace's home zone so the
 * server (UTC container) and the browser render the same day. Using
 * `new Date()` during render makes them disagree in the evening (US time)
 * and causes a hydration mismatch (React #418).
 */
export const HOST_TIME_ZONE = "America/Chicago";

/** YYYY-MM-DD for `now` in `timeZone`, independent of the process zone. */
export function hostTodayYmd(
  now: Date = new Date(),
  timeZone: string = HOST_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Local-midnight Date for a YYYY-MM-DD (same calendar day in any zone). */
export function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** First of the month containing a YYYY-MM-DD, as a local Date. */
export function monthStartFromYmd(ymd: string): Date {
  const d = dateFromYmd(ymd);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
