import { prisma } from "@/lib/db";
import { addDaysYmd, formatYmd, nightsBetweenYmd } from "@/lib/search-dates";

export type AvailableWindow = {
  checkIn: string;
  checkOut: string;
  nights: number;
};

/**
 * Find free stay windows of `nights` length in [fromYmd, fromYmd+lookAheadDays).
 * Uses calendar blocks (blocked if any overlap with [start, end)).
 */
export async function findAvailableWindows(opts: {
  propertyId: string;
  nights?: number;
  fromYmd?: string;
  lookAheadDays?: number;
  maxWindows?: number;
  minNights?: number;
}): Promise<AvailableWindow[]> {
  const nights = Math.max(
    1,
    Math.floor(opts.nights ?? opts.minNights ?? 2),
  );
  const lookAhead = Math.min(180, Math.max(14, opts.lookAheadDays ?? 90));
  const maxWindows = Math.min(20, Math.max(1, opts.maxWindows ?? 5));
  const today = formatYmd(new Date());
  const fromYmd =
    opts.fromYmd && /^\d{4}-\d{2}-\d{2}$/.test(opts.fromYmd)
      ? opts.fromYmd < today
        ? today
        : opts.fromYmd
      : today;

  const rangeEnd = addDaysYmd(fromYmd, lookAhead + nights);
  const blocks = await prisma.calendarBlock.findMany({
    where: {
      propertyId: opts.propertyId,
      startDate: { lt: new Date(`${rangeEnd}T12:00:00`) },
      endDate: { gt: new Date(`${fromYmd}T12:00:00`) },
    },
    select: { startDate: true, endDate: true },
  });

  function isFree(startYmd: string, endYmd: string): boolean {
    const start = new Date(`${startYmd}T00:00:00`);
    const end = new Date(`${endYmd}T00:00:00`);
    for (const b of blocks) {
      if (b.startDate < end && b.endDate > start) return false;
    }
    return true;
  }

  const windows: AvailableWindow[] = [];
  for (let i = 0; i <= lookAhead; i++) {
    const checkIn = addDaysYmd(fromYmd, i);
    const checkOut = addDaysYmd(checkIn, nights);
    if (isFree(checkIn, checkOut)) {
      windows.push({ checkIn, checkOut, nights });
      if (windows.length >= maxWindows) break;
      // Skip ahead a bit so windows aren't all consecutive overlaps
      i += Math.max(0, nights - 1);
    }
  }
  return windows;
}

/** Whether a specific exact stay is free of calendar blocks. */
export async function isStayAvailable(
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<boolean> {
  if (nightsBetweenYmd(checkIn, checkOut) < 1) return false;
  const start = new Date(`${checkIn}T00:00:00`);
  const end = new Date(`${checkOut}T00:00:00`);
  const hit = await prisma.calendarBlock.findFirst({
    where: {
      propertyId,
      startDate: { lt: end },
      endDate: { gt: start },
    },
    select: { id: true },
  });
  return !hit;
}

/**
 * For ±flex around preferred check-in, return matching free windows
 * of the same night count.
 */
export async function flexibleWindowsAround(opts: {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  flexibilityDays: number;
}): Promise<AvailableWindow[]> {
  const nights = nightsBetweenYmd(opts.checkIn, opts.checkOut);
  if (nights < 1) return [];
  const flex = Math.min(14, Math.max(0, Math.floor(opts.flexibilityDays)));
  const windows: AvailableWindow[] = [];

  const rangeStart = addDaysYmd(opts.checkIn, -flex);
  const rangeEnd = addDaysYmd(opts.checkOut, flex);
  const blocks = await prisma.calendarBlock.findMany({
    where: {
      propertyId: opts.propertyId,
      startDate: { lt: new Date(`${rangeEnd}T12:00:00`) },
      endDate: { gt: new Date(`${rangeStart}T12:00:00`) },
    },
    select: { startDate: true, endDate: true },
  });

  function isFree(startYmd: string, endYmd: string): boolean {
    const start = new Date(`${startYmd}T00:00:00`);
    const end = new Date(`${endYmd}T00:00:00`);
    for (const b of blocks) {
      if (b.startDate < end && b.endDate > start) return false;
    }
    return true;
  }

  for (let d = -flex; d <= flex; d++) {
    const checkIn = addDaysYmd(opts.checkIn, d);
    const checkOut = addDaysYmd(checkIn, nights);
    if (isFree(checkIn, checkOut)) {
      windows.push({ checkIn, checkOut, nights });
    }
  }
  return windows;
}
