"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  addDaysYmd,
  formatYmd,
  nightsBetweenYmd,
} from "@/lib/search-dates";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const FLEX_OPTIONS = [0, 1, 2, 3, 7, 14] as const;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthMatrix(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function formatShortRange(checkIn: string, checkOut: string): string {
  if (!YMD.test(checkIn) || !YMD.test(checkOut)) return "Add dates";
  const a = parseYmd(checkIn);
  const b = parseYmd(checkOut);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${a.toLocaleDateString("en-US", opts)} – ${b.toLocaleDateString("en-US", opts)}`;
}

function flexLabel(n: number): string {
  if (n === 0) return "Exact dates";
  return `± ${n} day${n === 1 ? "" : "s"}`;
}

export type SearchDateRangePickerProps = {
  checkIn: string;
  checkOut: string;
  dateFlex: number;
  onChange: (next: {
    checkIn: string;
    checkOut: string;
    dateFlex: number;
  }) => void;
  /** Compact pill for hero / marketplace bar */
  className?: string;
  /** Hidden form field names */
  nameCheckIn?: string;
  nameCheckOut?: string;
  nameDateFlex?: string;
  minDate?: string;
};

/**
 * Airbnb-style When control: one popover, check-in then check-out on the same
 * calendars, plus exact / ± flex chips (and clear = fully flexible).
 */
export function SearchDateRangePicker({
  checkIn,
  checkOut,
  dateFlex,
  onChange,
  className,
  nameCheckIn = "checkIn",
  nameCheckOut = "checkOut",
  nameDateFlex = "dateFlex",
  minDate,
}: SearchDateRangePickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const mounted = useIsClient();
  const [mode, setMode] = useState<"dates" | "flexible">(
    checkIn && checkOut ? "dates" : "flexible",
  );
  const [picking, setPicking] = useState<"in" | "out">("in");
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const today = minDate && YMD.test(minDate) ? minDate : formatYmd(new Date());

  useEffect(() => {
    if (!open) return;
    function place() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.min(720, Math.max(320, window.innerWidth - 24));
      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      setBox({
        top: r.bottom + 8,
        left,
        width,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const panel = document.getElementById(listId);
      if (panel?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, listId]);

  const summary = useMemo(() => {
    if (!checkIn || !checkOut || nightsBetweenYmd(checkIn, checkOut) < 1) {
      return mode === "flexible" ? "I'm flexible" : "Add dates";
    }
    const base = formatShortRange(checkIn, checkOut);
    if (dateFlex > 0) return `${base} · ±${dateFlex}d`;
    return base;
  }, [checkIn, checkOut, dateFlex, mode]);

  function onDayClick(key: string) {
    if (key < today) return;
    setMode("dates");

    if (picking === "in" || !checkIn || (checkIn && checkOut)) {
      onChange({ checkIn: key, checkOut: "", dateFlex });
      setPicking("out");
      setHoverDay(null);
      return;
    }

    // picking out
    if (key === checkIn) {
      // same day → 1 night default
      onChange({
        checkIn: key,
        checkOut: addDaysYmd(key, 1),
        dateFlex,
      });
      setPicking("in");
      return;
    }
    if (key < checkIn) {
      onChange({ checkIn: key, checkOut: "", dateFlex });
      setPicking("out");
      return;
    }
    onChange({ checkIn, checkOut: key, dateFlex });
    setPicking("in");
  }

  function clearDates() {
    onChange({ checkIn: "", checkOut: "", dateFlex: 0 });
    setMode("flexible");
    setPicking("in");
    setHoverDay(null);
  }

  function setFlex(n: number) {
    onChange({
      checkIn,
      checkOut,
      dateFlex: n,
    });
    if (checkIn && checkOut) setMode("dates");
  }

  function isInPreviewRange(key: string): boolean {
    if (!checkIn || checkOut) return false;
    if (picking !== "out" || !hoverDay) return false;
    const a = checkIn < hoverDay ? checkIn : hoverDay;
    const b = checkIn < hoverDay ? hoverDay : checkIn;
    return key > a && key < b;
  }

  function isInSelectedRange(key: string): boolean {
    if (!checkIn || !checkOut) return false;
    return key > checkIn && key < checkOut;
  }

  const months = [cursor, addMonths(cursor, 1)];

  const panel: ReactNode =
    open && mounted && box
      ? createPortal(
          <div
            id={listId}
            role="dialog"
            aria-label="Choose dates"
            className="fixed z-[280] overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: "min(85vh, 640px)",
            }}
          >
            <div className="flex max-h-[min(85vh,640px)] flex-col overflow-y-auto">
              {/* Tabs */}
              <div className="flex justify-center gap-1 border-b border-stone-100 px-4 pt-4 pb-3">
                <button
                  type="button"
                  onClick={() => setMode("dates")}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                    mode === "dates"
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200",
                  )}
                >
                  Dates
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("flexible");
                    clearDates();
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                    mode === "flexible"
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200",
                  )}
                >
                  Flexible
                </button>
              </div>

              {mode === "flexible" ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-lg font-semibold text-stone-900">
                    I&apos;m flexible
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">
                    Search without fixed dates to see every available stay.
                    Pick exact dates anytime if you want availability filtered.
                  </p>
                  <button
                    type="button"
                    className="mt-6 rounded-full bg-bonnet px-5 py-2.5 text-sm font-semibold text-white hover:bg-bonnet-hover"
                    onClick={() => {
                      clearDates();
                      setOpen(false);
                    }}
                  >
                    Search any dates
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 pt-2 sm:px-6">
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full hover:bg-stone-100"
                      aria-label="Previous month"
                      onClick={() => setCursor(addMonths(cursor, -1))}
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <p className="text-sm font-semibold text-stone-900 sm:hidden">
                      {cursor.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-full hover:bg-stone-100"
                      aria-label="Next month"
                      onClick={() => setCursor(addMonths(cursor, 1))}
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </div>

                  <div className="grid gap-6 px-3 pb-2 sm:grid-cols-2 sm:px-5">
                    {months.map((monthDate, mi) => {
                      const y = monthDate.getFullYear();
                      const m = monthDate.getMonth();
                      const cells = monthMatrix(y, m);
                      return (
                        <div key={`${y}-${m}`} className={mi === 1 ? "hidden sm:block" : ""}>
                          <p className="mb-2 text-center text-sm font-semibold text-stone-900">
                            {monthDate.toLocaleDateString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                          <div className="mb-1 grid grid-cols-7">
                            {WEEKDAYS.map((d, i) => (
                              <div
                                key={`${d}-${i}`}
                                className="py-1 text-center text-[11px] font-medium text-stone-400"
                              >
                                {d}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7">
                            {cells.map((date) => {
                              const key = formatYmd(date);
                              const inMonth = date.getMonth() === m;
                              const past = key < today;
                              const isStart = key === checkIn;
                              const isEnd = key === checkOut;
                              const inRange =
                                isInSelectedRange(key) || isInPreviewRange(key);
                              const disabled = !inMonth || past;

                              return (
                                <button
                                  key={key + String(m)}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => onDayClick(key)}
                                  onMouseEnter={() => {
                                    if (picking === "out" && checkIn && !checkOut) {
                                      setHoverDay(key);
                                    }
                                  }}
                                  onMouseLeave={() => setHoverDay(null)}
                                  className={cn(
                                    "relative flex h-10 items-center justify-center text-sm transition sm:h-11",
                                    disabled && "text-stone-300",
                                    !disabled && "text-stone-900 hover:bg-stone-100",
                                    inRange && !isStart && !isEnd && "bg-stone-100",
                                    (isStart || isEnd) &&
                                      "rounded-full bg-stone-900 font-semibold text-white hover:bg-stone-800",
                                  )}
                                >
                                  {date.getDate()}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="px-5 pb-2 text-center text-xs text-stone-500">
                    {picking === "out" && checkIn && !checkOut
                      ? "Select check-out"
                      : checkIn && checkOut
                        ? `${nightsBetweenYmd(checkIn, checkOut)} night${nightsBetweenYmd(checkIn, checkOut) === 1 ? "" : "s"} selected`
                        : "Select check-in, then check-out"}
                  </p>
                </>
              )}

              {/* Flexibility chips */}
              <div className="border-t border-stone-100 px-4 py-3 sm:px-5">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                  Flexibility
                </p>
                <div className="flex flex-wrap gap-2">
                  {FLEX_OPTIONS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={mode === "flexible" && n > 0}
                      onClick={() => setFlex(n)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        dateFlex === n && mode === "dates"
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 bg-white text-stone-700 hover:border-stone-400",
                        mode === "flexible" && n > 0 && "opacity-40",
                      )}
                    >
                      {flexLabel(n)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  className="text-sm font-semibold text-stone-700 underline-offset-2 hover:underline"
                  onClick={clearDates}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="rounded-full bg-bonnet px-5 py-2 text-sm font-semibold text-white hover:bg-bonnet-hover"
                  onClick={() => setOpen(false)}
                >
                  {checkIn && checkOut ? "Apply" : "Done"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative min-w-0 flex-1", className)}>
      <input type="hidden" name={nameCheckIn} value={checkIn} />
      <input type="hidden" name={nameCheckOut} value={checkOut} />
      <input
        type="hidden"
        name={nameDateFlex}
        value={dateFlex > 0 ? String(dateFlex) : ""}
      />

      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (checkIn && !checkOut) setPicking("out");
          else if (checkIn && checkOut) setPicking("in");
        }}
        className="flex w-full min-w-0 flex-col gap-0.5 rounded-xl px-4 py-3 text-left hover:bg-stone-50 sm:rounded-none sm:py-2.5"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          When
        </span>
        <span
          className={cn(
            "truncate text-base sm:text-sm",
            checkIn && checkOut ? "text-stone-900" : "text-stone-400",
          )}
        >
          {summary}
        </span>
      </button>
      {panel}
    </div>
  );
}
