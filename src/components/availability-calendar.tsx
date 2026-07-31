"use client";

import { useMemo, useState } from "react";
import { cn, formatDateRangeUS } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function todayYmd() {
  return ymd(new Date());
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
}: Props) {
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates]);
  const [cursor, setCursor] = useState(() => {
    if (checkIn) {
      const d = new Date(checkIn + "T12:00:00");
      if (!Number.isNaN(d.getTime())) return startOfMonth(d);
    }
    return startOfMonth(new Date());
  });
  const today = todayYmd();

  const months = useMemo(() => {
    return Array.from({ length: monthsToShow }, (_, i) => addMonths(cursor, i));
  }, [cursor, monthsToShow]);

  function handleDayClick(key: string, unavailableNight: boolean) {
    if (!selectable || !onChange) return;
    // Past nights cannot be selected as check-in
    if (key < today) return;

    // Selecting check-out: checkout morning can land on a blocked night's date
    // as long as stay nights [checkIn, key) are free.
    if (checkIn && !checkOut) {
      if (key === checkIn) {
        onChange({ checkIn: "", checkOut: "" });
        return;
      }
      if (key < checkIn) {
        // Restart with earlier check-in if that night is free
        if (!blocked.has(key)) onChange({ checkIn: key, checkOut: "" });
        return;
      }
      if (rangeNightsFree(checkIn, key, blocked)) {
        onChange({ checkIn, checkOut: key });
      }
      return;
    }

    // Start new selection (check-in must be an available night)
    if (unavailableNight) return;
    onChange({ checkIn: key, checkOut: "" });
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold text-stone-900",
              compact ? "text-sm" : "text-xl",
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
            <p className="mt-0.5 text-[11px] text-stone-500">
              {checkIn && checkOut
                ? formatDateRangeUS(checkIn, checkOut)
                : checkIn
                  ? "Select checkout"
                  : "Select check-in"}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
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
              onClick={() => setCursor(startOfMonth(new Date()))}
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
          "mt-3 grid gap-6",
          monthsToShow === 2 ? "lg:grid-cols-2" : "",
          compact ? "mt-2 gap-3" : "mt-6 gap-8",
        )}
      >
        {months.map((month) => (
          <MonthGrid
            key={ymd(month)}
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
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-stone-200 ring-1 ring-stone-300" />
          Unavailable
        </span>
        {selectable ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-bonnet" />
            Selected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-white ring-2 ring-bonnet" />
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
  month,
  blocked,
  today,
  compact,
  selectable,
  checkIn,
  checkOut,
  onDayClick,
}: {
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
    <div>
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
          "grid grid-cols-7 gap-1 text-center font-medium uppercase tracking-wide text-stone-400",
          compact ? "text-[9px]" : "text-[11px]",
        )}
      >
        {WEEKDAYS.map((w) => (
          <div key={w} className={compact ? "py-0.5" : "py-1"}>
            {compact ? w.slice(0, 1) : w}
          </div>
        ))}
      </div>
      <div className={cn("mt-1 grid grid-cols-7", compact ? "gap-0.5" : "gap-1")}>
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
            selectable && (canClickAsCheckIn || canClickAsCheckout || isCheckIn);

          const baseStyle = selected
            ? isCheckIn || isCheckOut
              ? "bg-bonnet text-white ring-1 ring-bonnet-hover"
              : "bg-petal text-blue-950 ring-1 ring-blue-200"
            : unavailableNight
              ? "bg-stone-100 text-stone-400 line-through decoration-stone-300"
              : "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80";

          const Comp = interactive ? "button" : "div";

          return (
            <Comp
              key={key}
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
                "flex aspect-square items-center justify-center rounded-lg tabular-nums",
                compact ? "text-[11px]" : "text-sm",
                baseStyle,
                !selected && isToday ? "ring-2 ring-bonnet ring-offset-1" : "",
                interactive
                  ? "cursor-pointer transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bonnet"
                  : "",
              )}
            >
              {day.getDate()}
            </Comp>
          );
        })}
      </div>
    </div>
  );
}
