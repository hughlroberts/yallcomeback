"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";
import { hostTodayYmd, monthStartFromYmd } from "@/lib/host-today";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function addDaysYmd(key: string, days: number): string {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + days);
  return ymd(d);
}

/** Nights of a stay are [checkIn, checkOut). All must be free. */
function rangeNightsFree(
  checkIn: string,
  checkOut: string,
  blocked: Set<string>,
): boolean {
  if (checkOut <= checkIn) return false;
  let cur = checkIn;
  while (cur < checkOut) {
    if (blocked.has(cur)) return false;
    cur = addDaysYmd(cur, 1);
  }
  return true;
}

/**
 * What a tap on `key` selects. Null when the tap does nothing. Never moves
 * the calendar: the months on screen stay where they are between taps.
 */
/** "Nov 10 → Nov 13" (adds years only when they differ): short enough to sit
 *  beside the month arrows on a phone without wrapping. */
export function shortRangeLabel(checkIn: string, checkOut: string): string {
  const fmt = (key: string, withYear: boolean) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(withYear ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  const crossYear = checkIn.slice(0, 4) !== checkOut.slice(0, 4);
  return `${fmt(checkIn, crossYear)} → ${fmt(checkOut, crossYear)}`;
}

export function nextDateSelection({
  key,
  unavailableNight,
  checkIn,
  checkOut,
  blocked,
  today,
}: {
  key: string;
  unavailableNight: boolean;
  checkIn: string;
  checkOut: string;
  blocked: Set<string>;
  today: string;
}): { checkIn: string; checkOut: string } | null {
  // Past nights cannot be selected as check-in
  if (key < today) return null;

  // Selecting check-out: checkout morning can land on a blocked night's date
  // as long as stay nights [checkIn, key) are free.
  if (checkIn && !checkOut) {
    if (key === checkIn) return { checkIn: "", checkOut: "" };
    if (key < checkIn) {
      // Restart with the earlier check-in if that night is free
      return blocked.has(key) ? null : { checkIn: key, checkOut: "" };
    }
    return rangeNightsFree(checkIn, key, blocked)
      ? { checkIn, checkOut: key }
      : null;
  }

  // Start new selection (check-in must be an available night)
  if (unavailableNight) return null;
  return { checkIn: key, checkOut: "" };
}

type Props = {
  blockedDates: string[];
  /** Optional seasonal night markers for legend context */
  seasonRanges?: { name: string; startDate: string; endDate: string }[];
  title?: string;
  monthsToShow?: 1 | 2;
  /** Compact styles for the reserve card */
  compact?: boolean;
  /** Interactive date selection for booking */
  selectable?: boolean;
  checkIn?: string;
  checkOut?: string;
  onChange?: (next: { checkIn: string; checkOut: string }) => void;
  className?: string;
  /** Today (YYYY-MM-DD) from the server so SSR and hydration agree. */
  todayYmd?: string;
};

export function AvailabilityCalendar({
  blockedDates,
  seasonRanges = [],
  title = "Availability",
  monthsToShow = 2,
  compact = false,
  selectable = false,
  checkIn = "",
  checkOut = "",
  onChange,
  className,
  todayYmd,
}: Props) {
  const today = todayYmd ?? hostTodayYmd();
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);
  const [cursor, setCursor] = useState(() => {
    if (checkIn) {
      const d = new Date(checkIn + "T12:00:00");
      if (!Number.isNaN(d.getTime())) return startOfMonth(d);
    }
    return monthStartFromYmd(today);
  });
  // Always render the same months so the grid never moves under the
  // guest's finger. Compact phones hide the second month with CSS (not
  // matchMedia state), so SSR, hydration, and every click share one layout.
  const visibleMonths = monthsToShow;

  const months = useMemo(() => {
    return Array.from({ length: visibleMonths }, (_, i) =>
      addMonths(cursor, i),
    );
  }, [cursor, visibleMonths]);

  function handleDayClick(key: string, unavailableNight: boolean) {
    if (!selectable || !onChange) return;
    const next = nextDateSelection({
      key,
      unavailableNight,
      checkIn,
      checkOut,
      blocked,
      today,
    });
    // The visible months stay put: moving the cursor here shifted the grid
    // so the guest's next tap landed on a different date.
    if (next) onChange(next);
  }

  return (
    <div
      className={cn(
        compact
          ? "rounded-xl border border-stone-200 bg-white p-3"
          : "rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      {/* Compact header: one row, fixed height, so swapping "Select checkout"
          for the picked range never wraps the arrows and pushes the grid down
          between taps. */}
      <div
        className={cn(
          "flex justify-between gap-2",
          compact ? "h-10 flex-nowrap items-center" : "flex-wrap items-start",
        )}
        data-calendar-header
      >
        <div className={cn("min-w-0", compact && "flex-1")}>
          <h2
            className={cn(
              "font-semibold text-stone-900",
              compact ? "truncate text-sm leading-5" : "text-xl",
            )}
          >
            {title}
          </h2>
          {!compact ? (
            <p className="mt-1 text-sm text-stone-500">
              Grey dates are nights that are already booked or blocked. Checkout
              day may still be free.
            </p>
          ) : selectable ? (
            <p
              className="truncate text-[11px] leading-4 text-stone-500"
              aria-live="polite"
            >
              {checkIn && checkOut
                ? shortRangeLabel(checkIn, checkOut)
                : checkIn
                  ? "Select checkout"
                  : "Select check-in"}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className={cn(
              "rounded-full border border-stone-300 font-medium text-stone-700 hover:bg-stone-50",
              compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
            )}
            aria-label="Previous month"
          >
            ←
          </button>
          {!compact ? (
            <button
              type="button"
              onClick={() => setCursor(monthStartFromYmd(hostTodayYmd()))}
              className="rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Today
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className={cn(
              "rounded-full border border-stone-300 font-medium text-stone-700 hover:bg-stone-50",
              compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
            )}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid",
          // Compact: stack months. Full: side-by-side from md when 2 months visible.
          visibleMonths === 2
            ? compact
              ? "mt-2 gap-4"
              : "mt-6 gap-8 md:grid-cols-2"
            : compact
              ? "mt-2 gap-3"
              : "mt-6 gap-8",
        )}
      >
        {months.map((month, i) => (
          <MonthGrid
            key={ymd(month)}
            className={
              compact && i > 0 ? "hidden min-[480px]:block" : undefined
            }
            month={month}
            blocked={blocked}
            today={today}
            compact={compact}
            selectable={selectable}
            checkIn={checkIn}
            checkOut={checkOut}
            onDayClick={handleDayClick}
          />
        ))}
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-3 border-t border-stone-100 text-stone-600",
          compact ? "mt-3 gap-2 pt-2 text-[10px]" : "mt-6 gap-4 pt-4 text-xs",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-100 ring-1 ring-emerald-300/80" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-stone-100 ring-1 ring-stone-200" />
          Unavailable
        </span>
        {selectable ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bonnet" />
            Selected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white ring-2 ring-bonnet" />
            Today
          </span>
        )}
        {seasonRanges.length > 0 && !compact ? (
          <span className="text-stone-400">
            Seasonal rates may apply on some available nights.
          </span>
        ) : null}
        {selectable && (checkIn || checkOut) ? (
          <button
            type="button"
            onClick={() => onChange?.({ checkIn: "", checkOut: "" })}
            className="ml-auto text-[11px] font-medium text-bonnet hover:underline"
          >
            Clear dates
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MonthGrid({
  className,
  month,
  blocked,
  today,
  compact,
  selectable,
  checkIn,
  checkOut,
  onDayClick,
}: {
  className?: string;
  month: Date;
  blocked: Set<string>;
  today: string;
  compact?: boolean;
  selectable?: boolean;
  checkIn: string;
  checkOut: string;
  onDayClick: (key: string, unavailableNight: boolean) => void;
}) {
  const year = month.getFullYear();
  const mon = month.getMonth();
  const firstDow = new Date(year, mon, 1).getDay();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, mon, d));
  }

  return (
    <div className={className}>
      <p
        className={cn(
          "mb-2 text-center font-semibold text-stone-800",
          compact ? "mb-1.5 text-xs" : "mb-3 text-sm",
        )}
      >
        {monthLabel(month)}
      </p>
      <div
        className={cn(
          "grid grid-cols-7 text-center font-medium uppercase tracking-wide text-stone-400",
          compact ? "gap-0 text-[10px]" : "gap-1 text-[11px]",
        )}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className={compact ? "py-0.5" : "py-1"}>
            {w}
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-0.5 grid grid-cols-7",
          compact ? "gap-y-0.5" : "gap-1",
        )}
      >
        {cells.map((day, i) => {
          if (!day) {
            return <div key={`e-${i}`} className="aspect-square" />;
          }
          const key = ymd(day);
          const isPast = key < today;
          const isBlocked = blocked.has(key);
          const isToday = key === today;
          const unavailableNight = isPast || isBlocked;

          const isCheckIn = checkIn === key;
          const isCheckOut = checkOut === key;
          const inRange =
            Boolean(checkIn && checkOut) && key > checkIn && key < checkOut;
          const selected = isCheckIn || isCheckOut || inRange;

          // Checkout can be chosen on a blocked calendar day if stay nights free
          const canClickAsCheckout =
            selectable &&
            Boolean(checkIn && !checkOut) &&
            key > checkIn &&
            rangeNightsFree(checkIn, key, blocked);
          const canClickAsCheckIn = selectable && !unavailableNight && !isPast;
          const interactive =
            selectable &&
            (canClickAsCheckIn || canClickAsCheckout || isCheckIn);

          // Softer cells: no strikethrough clutter on past days
          let cellStyle: string;
          if (isCheckIn || isCheckOut) {
            cellStyle = "bg-bonnet text-white font-semibold";
          } else if (inRange) {
            cellStyle = "bg-petal text-blue-950";
          } else if (isPast) {
            cellStyle = "text-stone-300";
          } else if (isBlocked) {
            cellStyle = "text-stone-300 bg-stone-50";
          } else {
            cellStyle = "text-stone-800 hover:bg-emerald-50";
          }

          // Continuous range bar feel between check-in and check-out
          let rangeShape = "rounded-full";
          if (selected && checkIn && checkOut) {
            if (isCheckIn && isCheckOut) {
              rangeShape = "rounded-full";
            } else if (isCheckIn) {
              rangeShape = "rounded-l-full rounded-r-none";
            } else if (isCheckOut) {
              rangeShape = "rounded-r-full rounded-l-none";
            } else if (inRange) {
              rangeShape = "rounded-none";
            }
          }

          const Comp = interactive ? "button" : "div";

          return (
            <div
              key={key}
              className={cn(
                "relative flex aspect-square items-center justify-center",
                inRange || isCheckIn || isCheckOut ? "" : "",
                // Soft range background strip (behind endpoint pills)
                inRange ? "bg-petal" : "",
                isCheckIn && checkOut ? "bg-petal rounded-l-full" : "",
                isCheckOut && checkIn ? "bg-petal rounded-r-full" : "",
              )}
            >
              <Comp
                type={interactive ? "button" : undefined}
                disabled={interactive ? false : undefined}
                onClick={
                  interactive
                    ? () => onDayClick(key, unavailableNight)
                    : undefined
                }
                title={
                  isPast
                    ? "Past"
                    : isBlocked
                      ? "Unavailable night"
                      : selected
                        ? isCheckIn
                          ? "Check-in"
                          : isCheckOut
                            ? "Checkout"
                            : "In stay"
                        : "Available"
                }
                className={cn(
                  "flex h-[88%] w-[88%] items-center justify-center tabular-nums",
                  compact ? "text-[12px]" : "text-sm",
                  rangeShape,
                  cellStyle,
                  !selected && isToday
                    ? "ring-2 ring-bonnet ring-offset-1"
                    : "",
                  interactive
                    ? cn("cursor-pointer transition-colors", PRIMARY_CTA_FOCUS_CLASS)
                    : "cursor-default",
                  !interactive && isPast ? "pointer-events-none" : "",
                )}
              >
                {day.getDate()}
              </Comp>
            </div>
          );
        })}
      </div>
    </div>
  );
}
