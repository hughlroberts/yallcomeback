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
