import { describe, expect, it, vi } from "vitest";
import {
  announceSearchDates,
  SEARCH_DATES_EVENT,
  searchDatesFromEvent,
  searchFormKey,
} from "./search-date-sync";

describe("flexible-date chip → search form", () => {
  it("delivers the chip's dates to a listener synchronously", () => {
    const target = new EventTarget();
    const seen = vi.fn();
    target.addEventListener(SEARCH_DATES_EVENT, (e) =>
      seen(searchDatesFromEvent(e)),
    );
    announceSearchDates(target, {
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      dateFlex: 0,
    });
    // Before any navigation could finish: the form already has the new dates.
    expect(seen).toHaveBeenCalledWith({
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      dateFlex: 0,
    });
  });

  it("ignores malformed or inverted dates", () => {
    const ev = (detail: unknown) =>
      new CustomEvent(SEARCH_DATES_EVENT, { detail });
    expect(searchDatesFromEvent(ev(undefined))).toBeNull();
    expect(
      searchDatesFromEvent(ev({ checkIn: "Nov 6", checkOut: "2026-11-08" })),
    ).toBeNull();
    expect(
      searchDatesFromEvent(
        ev({ checkIn: "2026-11-08", checkOut: "2026-11-06" }),
      ),
    ).toBeNull();
    expect(
      searchDatesFromEvent(
        ev({ checkIn: "2026-11-06", checkOut: "2026-11-07", dateFlex: -2 }),
      ),
    ).toEqual({ checkIn: "2026-11-06", checkOut: "2026-11-07", dateFlex: 0 });
  });

  it("form key changes with any URL search field", () => {
    const base = {
      where: "Malakoff",
      checkIn: "2026-11-05",
      checkOut: "2026-11-06",
    };
    const key = searchFormKey(base);
    expect(searchFormKey({ ...base })).toBe(key);
    expect(
      searchFormKey({ ...base, checkIn: "2026-11-06", checkOut: "2026-11-08" }),
    ).not.toBe(key);
    expect(searchFormKey({ ...base, guests: "4" })).not.toBe(key);
    expect(
      searchFormKey({
        checkOut: base.checkOut,
        where: base.where,
        checkIn: base.checkIn,
      }),
    ).toBe(key);
  });
});
