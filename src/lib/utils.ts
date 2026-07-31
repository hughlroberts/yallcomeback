import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** US dollars (Texas marketplace). Always $ with en-US grouping. */
export function formatMoney(amount: number, currencySymbol = "$"): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${currencySymbol}${n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * US display date: "July 19, 2026".
 * Accepts Date or YYYY-MM-DD (parsed as local calendar day).
 */
export function formatDateUS(input: Date | string | null | undefined): string {
  if (input == null || input === "") return "";
  let d: Date;
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
    if (m) {
      d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    } else {
      d = new Date(input);
    }
  } else {
    d = input;
  }
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** e.g. "July 19, 2026 → July 23, 2026" */
export function formatDateRangeUS(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  const a = formatDateUS(start);
  const b = formatDateUS(end);
  if (a && b) return `${a} → ${b}`;
  return a || b || "";
}

/**
 * Guest-facing clock: never show 24-hour/"military" time.
 * "15:00" → "3:00 PM", "11:00" → "11:00 AM". Already-formatted strings pass through.
 */
export function formatTime12h(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  if (/\b(am|pm)\b/i.test(s)) {
    // Normalize spacing: "3:00PM" → "3:00 PM"
    return s.replace(/\s*(am|pm)\s*$/i, (_, ap) => ` ${ap.toUpperCase()}`);
  }
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return s;
  let h = Number(m[1]);
  const min = m[2]!;
  if (!Number.isFinite(h) || h < 0 || h > 23) return s;
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min} ${suffix}`;
}

/**
 * Normalize host-entered times to 24h HH:mm for storage.
 * Accepts "3:00 PM", "15:00", "3pm", etc. Falls back to default if unparseable.
 */
export function parseTimeTo24h(
  raw: string | null | undefined,
  fallback = "15:00",
): string {
  if (raw == null || String(raw).trim() === "") return fallback;
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, " ");

  const withMeridiem = /^(\d{1,2})(?::(\d{2}))?\s*(a|p)\.?m\.?$/.exec(s);
  if (withMeridiem) {
    let h = Number(withMeridiem[1]);
    const min = withMeridiem[2] ?? "00";
    const isPm = withMeridiem[3] === "p";
    if (h < 1 || h > 12 || Number(min) > 59) return fallback;
    if (isPm && h !== 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }

  const military = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (military) {
    const h = Number(military[1]);
    const min = military[2]!;
    if (h < 0 || h > 23 || Number(min) > 59) return fallback;
    return `${String(h).padStart(2, "0")}:${min}`;
  }

  return fallback;
}

export function parseAmenities(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  // Ranges are [start, end) - checkout day is free
  return startOfDay(aStart) < startOfDay(bEnd) && startOfDay(bStart) < startOfDay(aEnd);
}

export function eachNight(checkIn: Date, checkOut: Date): Date[] {
  const nights: Date[] = [];
  let cur = startOfDay(checkIn);
  const end = startOfDay(checkOut);
  while (cur < end) {
    nights.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return nights;
}
