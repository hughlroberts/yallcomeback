/**
 * Message timestamps in a given time zone (undefined = the runtime's zone,
 * which in the browser is the viewer's zone). Pure, so server and client
 * give the same text for the same zone.
 */

/** Zone used for the first (server) render, before the browser takes over. */
export const MESSAGE_TIME_FALLBACK_ZONE = "America/Chicago";

function parts(d: Date, timeZone?: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/** Calendar day in the zone, "yyyy-MM-dd". */
export function messageDayKey(d: Date, timeZone?: string): string {
  const { y, m, d: day } = parts(d, timeZone);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole calendar days from d to now in the zone (0 = same day). */
export function calendarDaysAgo(d: Date, now: Date, timeZone?: string): number {
  const a = parts(d, timeZone);
  const b = parts(now, timeZone);
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000,
  );
}

/** "3:55 PM" */
export function messageTimeLabel(d: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Day divider: "Today", "Yesterday", or "Monday, Nov 2". */
export function messageDayLabel(d: Date, now: Date, timeZone?: string): string {
  const ago = calendarDaysAgo(d, now, timeZone);
  if (ago === 0) return "Today";
  if (ago === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Conversation list: "11/2", "Yesterday", or "Mon" within a week. */
export function conversationListDateLabel(
  d: Date,
  now: Date,
  timeZone?: string,
): string {
  const ago = calendarDaysAgo(d, now, timeZone);
  if (ago === 1) return "Yesterday";
  if (ago > 1 && ago < 7) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "numeric",
    day: "numeric",
  }).format(d);
}
