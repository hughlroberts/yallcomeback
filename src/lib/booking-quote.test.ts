import { describe, expect, it } from "vitest";
import {
  PAST_DATES_ERROR,
  computeBookingQuote,
  initialPetCount,
  type BookingQuoteInput,
} from "@/lib/booking-quote";
import { bookingBarStateFromQuote } from "@/lib/booking-bar-state";

const base: BookingQuoteInput = {
  checkIn: "2030-03-04", // Mon
  checkOut: "2030-03-07", // Thu → 3 weekday nights
  pets: 0,
  baseNightlyRate: 100,
  weekendPremiumPercent: 0,
  discountNewListingPercent: 0,
  discountLastMinutePercent: 0,
  discountWeeklyPercent: 0,
  discountMonthlyPercent: 0,
  defaultMinNights: 1,
  cleaningFee: 50,
  petFee: 0,
  petFeeUnit: "PER_STAY",
  petsAllowed: false,
  maxPets: 0,
  depositPercent: 25,
  seasons: [],
  blocked: new Set(),
  taxLines: [],
  taxLiabilityAcknowledged: false,
};

describe("computeBookingQuote", () => {
  it("is null without both dates", () => {
    expect(computeBookingQuote({ ...base, checkOut: "" })).toBeNull();
  });
  it("totals nights + cleaning and the deposit", () => {
    const q = computeBookingQuote(base)!;
    expect(q.nights).toBe(3);
    expect(q.total).toBe(350);
    expect(q.deposit).toBe(87.5);
    expect(q.error).toBeUndefined();
  });
  it("reports minimum stay with nights", () => {
    const q = computeBookingQuote({ ...base, defaultMinNights: 5 })!;
    expect(q.error).toBe("Minimum stay is 5 nights");
    expect(q.nights).toBe(3);
  });
  it("uses season min nights and rate", () => {
    const q = computeBookingQuote({
      ...base,
      seasons: [
        {
          name: "Peak",
          startDate: "2030-03-01T00:00:00.000Z",
          endDate: "2030-03-31T00:00:00.000Z",
          nightlyRate: 200,
          minNights: 2,
        },
      ],
    })!;
    expect(q.total).toBe(650);
  });
  it("E1104-C1: past check-in is an error with no deposit/total", () => {
    const q = computeBookingQuote({
      ...base,
      checkIn: "2025-01-01",
      checkOut: "2025-01-04",
    })!;
    expect(q.error).toBe(PAST_DATES_ERROR);
    expect(q.nights).toBe(3);
    expect(q.total).toBeUndefined();
    expect(q.deposit).toBeUndefined();
  });
  it("flags blocked nights and bad ranges", () => {
    expect(
      computeBookingQuote({ ...base, blocked: new Set(["2030-03-05"]) })!.error,
    ).toBe("Selected dates include unavailable nights");
    expect(
      computeBookingQuote({ ...base, checkOut: "2030-03-04" })!.error,
    ).toBe("Check-out must be after check-in");
    expect(
      computeBookingQuote({ ...base, checkIn: "nope" })!.error,
    ).toBe("Choose valid dates");
  });
});

describe("initialPetCount", () => {
  const policy = { petsAllowed: true, petFee: 20, petFeeUnit: "PER_PET", maxPets: 2 };
  it("clamps to the cap and zero when pets aren't allowed", () => {
    expect(initialPetCount(policy, 5)).toBe(2);
    expect(initialPetCount(policy, undefined)).toBe(0);
    expect(initialPetCount({ ...policy, petsAllowed: false }, 2)).toBe(0);
  });
});

describe("bookingBarStateFromQuote (server first paint)", () => {
  it("carries dates and total for a valid range", () => {
    expect(
      bookingBarStateFromQuote(base.checkIn, base.checkOut, computeBookingQuote(base)),
    ).toEqual({
      checkIn: "2030-03-04",
      checkOut: "2030-03-07",
      nights: 3,
      total: 350,
      error: null,
    });
  });
  it("drops the total when the range is invalid", () => {
    const s = bookingBarStateFromQuote(
      base.checkIn,
      base.checkOut,
      computeBookingQuote({ ...base, defaultMinNights: 5 }),
    );
    expect(s.total).toBeNull();
    expect(s.error).toBe("Minimum stay is 5 nights");
  });
  it("is empty without dates", () => {
    expect(bookingBarStateFromQuote("", "", null)).toEqual({
      checkIn: "",
      checkOut: "",
      nights: null,
      total: null,
      error: null,
    });
  });
});
