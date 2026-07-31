/**
 * US peak holiday stay windows for min-night rules.
 * Ranges use [first night, last night] inclusive (checkout is the day after last night).
 */

export type PeakHolidayDef = {
  /** Stable id for matching seasons across years */
  key: string;
  name: string;
  /** First night of the stay window (local date YYYY-MM-DD) */
  startDate: string;
  /** Last night guests can stay under this rule */
  endDate: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + delta);
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** weekday: 0=Sun … 6=Sat; n: 1st, 2nd, … or -1 for last */
function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  n: number,
): { y: number; m: number; d: number } {
  if (n > 0) {
    const first = new Date(year, month - 1, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    const day = 1 + offset + (n - 1) * 7;
    return { y: year, m: month, d: day };
  }
  // last
  const last = new Date(year, month, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  const day = last.getDate() - offset;
  return { y: year, m: month, d: day };
}

function friThroughMon(year: number, month: number, mondayDay: number) {
  // Monday holiday → weekend Fri–Mon
  const start = addDays(year, month, mondayDay, -3);
  const end = ymd(year, month, mondayDay);
  return { start, end };
}

function weekendAround(year: number, month: number, day: number) {
  const d = new Date(year, month - 1, day);
  const wd = d.getDay(); // 0 Sun … 6 Sat
  // Expand to a long weekend covering the holiday
  let startOffset = 0;
  let endOffset = 0;
  if (wd === 0) {
    // Sunday → Fri–Sun
    startOffset = -2;
    endOffset = 0;
  } else if (wd === 1) {
    // Monday → Fri–Mon
    startOffset = -3;
    endOffset = 0;
  } else if (wd === 5) {
    // Friday → Fri–Sun
    startOffset = 0;
    endOffset = 2;
  } else if (wd === 6) {
    // Saturday → Fri–Sun
    startOffset = -1;
    endOffset = 1;
  } else if (wd === 4) {
    // Thursday → Thu–Sun
    startOffset = 0;
    endOffset = 3;
  } else if (wd === 3) {
    // Wednesday → Wed–Sun
    startOffset = 0;
    endOffset = 4;
  } else {
    // Tuesday → Fri–Mon of nearest weekend after
    startOffset = 3;
    endOffset = 6;
  }
  return {
    start: addDays(year, month, day, startOffset),
    end: addDays(year, month, day, endOffset),
  };
}

/** Peak holidays for a calendar year (US). */
export function peakHolidaysForYear(year: number): PeakHolidayDef[] {
  const mlk = nthWeekday(year, 1, 1, 3); // 3rd Mon Jan
  const presidents = nthWeekday(year, 2, 1, 3); // 3rd Mon Feb
  const memorial = nthWeekday(year, 5, 1, -1); // last Mon May
  const labor = nthWeekday(year, 9, 1, 1); // 1st Mon Sep
  const thanksgiving = nthWeekday(year, 11, 4, 4); // 4th Thu Nov

  const jul4 = weekendAround(year, 7, 4);
  const memorialWk = friThroughMon(memorial.y, memorial.m, memorial.d);
  const laborWk = friThroughMon(labor.y, labor.m, labor.d);
  const mlkWk = friThroughMon(mlk.y, mlk.m, mlk.d);
  const presWk = friThroughMon(presidents.y, presidents.m, presidents.d);

  // Thanksgiving: Wed before through Sat
  const tgStart = addDays(thanksgiving.y, thanksgiving.m, thanksgiving.d, -1);
  const tgEnd = addDays(thanksgiving.y, thanksgiving.m, thanksgiving.d, 2);

  return [
    {
      key: `mlk-${year}`,
      name: `MLK Day ${year}`,
      startDate: mlkWk.start,
      endDate: mlkWk.end,
    },
    {
      key: `presidents-${year}`,
      name: `Presidents' Day ${year}`,
      startDate: presWk.start,
      endDate: presWk.end,
    },
    {
      key: `memorial-${year}`,
      name: `Memorial Day ${year}`,
      startDate: memorialWk.start,
      endDate: memorialWk.end,
    },
    {
      key: `july4-${year}`,
      name: `July 4th ${year}`,
      startDate: jul4.start,
      endDate: jul4.end,
    },
    {
      key: `labor-${year}`,
      name: `Labor Day ${year}`,
      startDate: laborWk.start,
      endDate: laborWk.end,
    },
    {
      key: `thanksgiving-${year}`,
      name: `Thanksgiving ${year}`,
      startDate: tgStart,
      endDate: tgEnd,
    },
    {
      key: `christmas-${year}`,
      name: `Christmas ${year}`,
      startDate: ymd(year, 12, 23),
      endDate: ymd(year, 12, 26),
    },
    {
      key: `newyear-${year}`,
      name: `New Year ${year}/${year + 1}`,
      startDate: ymd(year, 12, 30),
      endDate: ymd(year + 1, 1, 1),
    },
  ];
}

/** This year + next year (upcoming peaks hosts care about). */
export function upcomingPeakHolidays(from = new Date()): PeakHolidayDef[] {
  const y = from.getFullYear();
  const all = [...peakHolidaysForYear(y), ...peakHolidaysForYear(y + 1)];
  const today = ymd(from.getFullYear(), from.getMonth() + 1, from.getDate());
  return all.filter((h) => h.endDate >= today);
}

export const DEFAULT_PEAK_MIN_NIGHTS = 2;

export function seasonHolidayKey(name: string): string | null {
  // seasons stored as "Peak · Memorial Day 2026" or with holidayKey field
  const m = name.match(/^Peak · (.+)$/);
  return m ? m[1] : null;
}

export function peakSeasonName(holiday: PeakHolidayDef) {
  return `Peak · ${holiday.name}`;
}
