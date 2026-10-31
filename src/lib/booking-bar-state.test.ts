import { describe, expect, it, vi } from "vitest";
import {
  bookingBarCta,
  bookingBarDateLabel,
  getBookingBarState,
  getPublishedBookingBarState,
  getServerPublishedBookingBarState,
  publishBookingBarState,
  resetBookingBarState,
  runBookingBarAction,
  setBookingBarAction,
  subscribeBookingBar,
} from "@/lib/booking-bar-state";

describe("bookingBarDateLabel", () => {
  it("formats a range", () => {
    expect(bookingBarDateLabel("2026-11-03", "2026-11-06")).toBe("Nov 3 – Nov 6");
  });
  it("is null without both dates", () => {
    expect(bookingBarDateLabel("2026-11-03", "")).toBeNull();
    expect(bookingBarDateLabel("", "")).toBeNull();
  });
  it("is null for malformed dates", () => {
    expect(bookingBarDateLabel("11/03/2026", "2026-11-06")).toBeNull();
  });
});

describe("bookingBarCta", () => {
  it("matches the quote box", () => {
    expect(bookingBarCta(true)).toBe("Reserve");
    expect(bookingBarCta(false)).toBe("Request to book");
  });
});

describe("booking bar store", () => {
  it("notifies subscribers on change only", () => {
    resetBookingBarState();
    const fn = vi.fn();
    const unsub = subscribeBookingBar(fn);
    const next = {
      checkIn: "2026-11-03",
      checkOut: "2026-11-06",
      nights: 3,
      total: 450,
      error: null,
    };
    publishBookingBarState(next);
    publishBookingBarState({ ...next });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(getBookingBarState().total).toBe(450);
    unsub();
    resetBookingBarState();
  });
  it("runs the registered book action", () => {
    const action = vi.fn();
    setBookingBarAction(action);
    expect(runBookingBarAction()).toBe(true);
    expect(action).toHaveBeenCalled();
    setBookingBarAction(null);
    expect(runBookingBarAction()).toBe(false);
  });
  it("is unpublished until the widget publishes, and again after reset", () => {
    resetBookingBarState();
    expect(getServerPublishedBookingBarState()).toBeNull();
    expect(getPublishedBookingBarState()).toBeNull();
    const fn = vi.fn();
    const unsub = subscribeBookingBar(fn);
    // First publish notifies even when equal to the empty state (dates cleared).
    publishBookingBarState({
      checkIn: "",
      checkOut: "",
      nights: null,
      total: null,
      error: null,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(getPublishedBookingBarState()).not.toBeNull();
    resetBookingBarState();
    expect(getPublishedBookingBarState()).toBeNull();
    unsub();
  });
});
