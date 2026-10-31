/**
 * "More stays with flexible dates" for marketplace search.
 *
 * Pure (no DB) so search, the /marketplace panel, and the JSON APIs share one
 * rule for "does this stay fit these dates": no calendar block overlaps the
 * nights, and the trip meets the listing minimum (default, raised by any peak
 * season that covers one of the nights — the same rule booking uses).
 */
import { addDaysYmd, formatYmd, isYmd, nightsBetweenYmd } from "@/lib/search-dates";

export type FlexBlock = { start: Date; end: Date };
export type FlexSeason = { startDate: Date; endDate: Date; minNights: number };

export type FlexListing = {
  id: string;
  defaultMinNights: number;
  /** Calendar blocks: nights [start, end) are unavailable. */
  blocks: readonly FlexBlock[];
  seasons: readonly FlexSeason[];
};

export type StayFit = "ok" | "blocked" | "min_stay";

/** Same day boundary search has always used: local midnight of the YMD. */
function dayStart(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

/** Season dates compare by calendar day, as in the booking quote. */
function seasonYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Minimum nights for this exact stay: listing default, raised by peak seasons. */
export function requiredMinNights(
  listing: Pick<FlexListing, "defaultMinNights" | "seasons">,
  checkIn: string,
  checkOut: string,
): number {
  let min = Math.max(1, listing.defaultMinNights || 1);
  const nights = nightsBetweenYmd(checkIn, checkOut);
  for (let i = 0; i < nights; i++) {
    const night = addDaysYmd(checkIn, i);
    for (const s of listing.seasons) {
      // minNights 0 = "no peak min" (keep default)
      if (s.minNights > 0 && night >= seasonYmd(s.startDate) && night <= seasonYmd(s.endDate)) {
        min = Math.max(min, s.minNights);
      }
    }
  }
  return min;
}

export function stayFit(listing: FlexListing, checkIn: string, checkOut: string): StayFit {
  const start = dayStart(checkIn);
  const end = dayStart(checkOut);
  for (const b of listing.blocks) {
    if (b.start < end && b.end > start) return "blocked";
  }
  if (nightsBetweenYmd(checkIn, checkOut) < requiredMinNights(listing, checkIn, checkOut)) {
    return "min_stay";
  }
  return "ok";
}

export type CandidateWindow = {
  checkIn: string;
  checkOut: string;
  nights: number;
  /** Check-in moved by this many days (negative = earlier). */
  shiftDays: number;
  /** Nights added to reach a listing minimum (0 = same length). */
  addedNights: number;
};

export const FLEX_MAX_SHIFT_DAYS = 3;
/** Never suggest stretching a trip by more than this to meet a minimum. */
export const FLEX_MAX_ADDED_NIGHTS = 3;
/** Distinct extended lengths to try (smallest first). */
const FLEX_MAX_EXTEND_LENGTHS = 2;

/**
 * Alternative windows around a search:
 * - same length, check-in shifted ±1, ±2, ±3 days (closest first);
 * - longer stays that meet a listing minimum, extended after (same check-in)
 *   or before (same check-out).
 * Never starts before `today`; never repeats the searched window.
 */
export function candidateWindows(input: {
  checkIn: string;
  checkOut: string;
  today: string;
  /** Minimum-night values that exceed the searched length (e.g. [2]). */
  extendTo?: readonly number[];
  maxShift?: number;
}): CandidateWindow[] {
  const { checkIn, checkOut, today } = input;
  if (!isYmd(checkIn) || !isYmd(checkOut)) return [];
  const nights = nightsBetweenYmd(checkIn, checkOut);
  if (nights < 1) return [];
  const maxShift = Math.max(0, Math.min(7, input.maxShift ?? FLEX_MAX_SHIFT_DAYS));

  const out: CandidateWindow[] = [];
  const seen = new Set<string>([`${checkIn}|${checkOut}`]);
  const push = (w: CandidateWindow) => {
    const key = `${w.checkIn}|${w.checkOut}`;
    if (seen.has(key) || w.checkIn < today) return;
    seen.add(key);
    out.push(w);
  };

  const lengths = Array.from(new Set(input.extendTo ?? []))
    .filter((n) => Number.isFinite(n) && n > nights && n - nights <= FLEX_MAX_ADDED_NIGHTS)
    .sort((a, b) => a - b)
    .slice(0, FLEX_MAX_EXTEND_LENGTHS);
  for (const len of lengths) {
    const added = len - nights;
    push({ checkIn, checkOut: addDaysYmd(checkIn, len), nights: len, shiftDays: 0, addedNights: added });
    push({ checkIn: addDaysYmd(checkIn, -added), checkOut, nights: len, shiftDays: -added, addedNights: added });
  }

  for (let d = 1; d <= maxShift; d++) {
    for (const s of [-d, d]) {
      const ci = addDaysYmd(checkIn, s);
      push({ checkIn: ci, checkOut: addDaysYmd(ci, nights), nights, shiftDays: s, addedNights: 0 });
    }
  }
  return out;
}

export type ScoredWindow = CandidateWindow & { count: number };

/** How far a suggestion is from what the guest asked for (smaller = closer). */
export function windowDistance(w: CandidateWindow): number {
  return w.addedNights > 0 ? w.addedNights : Math.abs(w.shiftDays);
}

/**
 * Keep only windows with more stays than the current search, best first:
 * most stays, then closest to the searched dates (a longer stay that keeps the
 * check-in before one that moves it), then earlier check-in.
 */
export function rankFlexibleWindows(
  scored: readonly ScoredWindow[],
  currentCount: number,
  limit = 4,
): ScoredWindow[] {
  return scored
    .filter((w) => w.count > currentCount)
    .slice()
    .sort(
      (a, b) =>
        b.count - a.count ||
        windowDistance(a) - windowDistance(b) ||
        a.addedNights - b.addedNights ||
        // keep the guest's check-in when we can
        Math.abs(a.shiftDays) - Math.abs(b.shiftDays) ||
        (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0),
    )
    .slice(0, Math.max(0, limit));
}

/** Results this small count as "limited" and get flexible-date help. */
export const FLEX_LIMITED_RESULTS = 3;

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 6–8", "Nov 30–Dec 2", "Dec 30–Jan 2". */
export function formatWindowLabel(checkIn: string, checkOut: string): string {
  const [, m1, d1] = checkIn.split("-").map(Number);
  const [, m2, d2] = checkOut.split("-").map(Number);
  const a = `${MONTH[m1 - 1]} ${d1}`;
  return m1 === m2 ? `${a}–${d2}` : `${a}–${MONTH[m2 - 1]} ${d2}`;
}

/** "5 stays", "1 stay", or "24+ stays" past the page size. */
export function formatStayCount(count: number, cap?: number): string {
  if (cap != null && count > cap) return `${cap}+ stays`;
  return `${count} stay${count === 1 ? "" : "s"}`;
}

export type FlexibleDateSuggestion = CandidateWindow & {
  count: number;
  /** Chip text, e.g. "Nov 6–8 · 5 stays" or "Nov 6–9 · 3 nights · 5 stays". */
  label: string;
  /** Same search with these dates, relative URL. */
  searchPath: string;
};

export type FlexibleDates = {
  /** Stays that fit the searched dates (same rule as the results). */
  currentCount: number;
  /** Stays free on these dates but hidden only by a minimum stay. */
  minStay: null | {
    count: number;
    /** Smallest minimum among them, e.g. 2. */
    minNights: number;
    message: string;
  };
  suggestions: FlexibleDateSuggestion[];
};

export type FlexSearchContext = {
  where?: string;
  guests?: number;
  pets?: number;
  remember?: string;
};

/** Clean /marketplace URL: only the params that are set. */
export function marketplaceSearchPath(
  ctx: FlexSearchContext,
  checkIn: string,
  checkOut: string,
): string {
  const sp = new URLSearchParams();
  if (ctx.where?.trim()) sp.set("where", ctx.where.trim());
  sp.set("checkIn", checkIn);
  sp.set("checkOut", checkOut);
  if (ctx.guests && ctx.guests > 0) sp.set("guests", String(ctx.guests));
  if (ctx.pets && ctx.pets > 0) sp.set("pets", String(ctx.pets));
  if (ctx.remember?.trim()) sp.set("remember", ctx.remember.trim());
  return `/marketplace?${sp.toString()}`;
}

export function minStayMessage(minNights: number): string {
  return `Some places need a ${minNights}-night minimum`;
}

/**
 * Whole computation over an already-filtered pool (location, guests, pets,
 * memory, agent filters). Returns null when there is nothing worth showing.
 */
export function computeFlexibleDates(input: {
  pool: readonly FlexListing[];
  checkIn: string;
  checkOut: string;
  today?: string;
  context?: FlexSearchContext;
  /** Results page size; counts above it read "24+ stays". */
  pageSize?: number;
  limit?: number;
}): FlexibleDates | null {
  const { pool, checkIn, checkOut } = input;
  const nights = nightsBetweenYmd(checkIn, checkOut);
  if (!isYmd(checkIn) || !isYmd(checkOut) || nights < 1 || pool.length === 0) return null;
  const today = input.today ?? formatYmd(new Date());

  let currentCount = 0;
  let excluded = 0;
  let minStayCount = 0;
  const extendTo = new Set<number>();
  let smallestMin = Infinity;
  for (const l of pool) {
    const fit = stayFit(l, checkIn, checkOut);
    if (fit === "ok") {
      currentCount++;
      continue;
    }
    excluded++;
    if (fit === "min_stay") {
      minStayCount++;
      const min = requiredMinNights(l, checkIn, checkOut);
      extendTo.add(min);
      smallestMin = Math.min(smallestMin, min);
    } else {
      // Blocked now; a longer trip might still need a minimum elsewhere.
      const min = Math.max(1, l.defaultMinNights || 1);
      if (min > nights) extendTo.add(min);
    }
  }

  const limited = currentCount < FLEX_LIMITED_RESULTS || excluded > 0;
  if (!limited) return null;

  const scored: ScoredWindow[] = candidateWindows({
    checkIn,
    checkOut,
    today,
    extendTo: Array.from(extendTo),
  }).map((w) => ({
    ...w,
    count: pool.reduce((n, l) => n + (stayFit(l, w.checkIn, w.checkOut) === "ok" ? 1 : 0), 0),
  }));

  const ctx = input.context ?? {};
  const suggestions = rankFlexibleWindows(scored, currentCount, input.limit ?? 4).map((w) => {
    const parts = [formatWindowLabel(w.checkIn, w.checkOut)];
    if (w.nights !== nights) parts.push(`${w.nights} nights`);
    parts.push(formatStayCount(w.count, input.pageSize));
    return {
      ...w,
      label: parts.join(" · "),
      searchPath: marketplaceSearchPath(ctx, w.checkIn, w.checkOut),
    };
  });

  const minStay =
    minStayCount > 0
      ? { count: minStayCount, minNights: smallestMin, message: minStayMessage(smallestMin) }
      : null;

  // Nothing beats the current search → show nothing (not even the note).
  if (suggestions.length === 0) return null;
  return { currentCount, minStay, suggestions };
}
