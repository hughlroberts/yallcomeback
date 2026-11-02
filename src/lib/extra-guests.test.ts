import { describe, expect, it } from "vitest";
import { clampGuests, extraGuestCharge } from "@/lib/extra-guests";
import {
  computeBookingQuote,
  type BookingQuoteInput,
} from "@/lib/booking-quote";
import { calculateQuote } from "@/lib/pricing";
import { toStripeAmount } from "@/lib/stripe";

// Shaped like live motel-room-2: $75 for 2 guests, $10/night per extra
// guest, sleeps 4, $35 cleaning.
const motel = {
  baseNightlyRate: 75,
  weekendPremiumPercent: 0,
  defaultMinNights: 1,
  cleaningFee: 35,
  extraGuestFee: 10,
  extraGuestsIncluded: 2,
  petFee: 0,
  petFeeUnit: "PER_STAY" as const,
  petsAllowed: false,
  maxPets: 0,
  depositPercent: 30,
  discountNewListingPercent: 0,
  discountLastMinutePercent: 0,
  discountWeeklyPercent: 0,
  discountMonthlyPercent: 0,
};
const checkIn = "2030-03-04"; // Mon
const checkOut = "2030-03-07"; // Thu, 3 nights

function widgetQuote(guests: number) {
  const input: BookingQuoteInput = {
    ...motel,
    checkIn,
    checkOut,
    pets: 0,
    guests,
    seasons: [],
    blocked: new Set(),
    taxLines: [],
    taxLiabilityAcknowledged: false,
  };
  return computeBookingQuote(input)!;
}

function bookQuote(guests: number) {
  return calculateQuote({
    property: motel,
    seasons: [],
    checkIn: new Date(checkIn + "T00:00:00"),
    checkOut: new Date(checkOut + "T00:00:00"),
    guests,
  });
}

describe("extra-guest charge ($10/night beyond 2)", () => {
  it.each([
    [1, 0],
    [2, 0],
    [3, 30],
    [4, 60],
  ])("%i guests add $%i over 3 nights on both quotes", (guests, extra) => {
    const lodging = 75 * 3;
    const total = lodging + extra + 35;
    const w = widgetQuote(guests);
    const b = bookQuote(guests);
    expect(w.extraGuestFee).toBe(extra);
    expect(b.extraGuestFee).toBe(extra);
    expect(w.total).toBe(total);
    expect(b.totalAmount).toBe(total);
    expect(b.depositAmount).toBe(w.deposit);
  });

  it("the Stripe deposit amount includes the extra-guest charge", () => {
    // 3 nights × $75 + 2 extra × $10 × 3 + $35 cleaning = 320; 30% deposit
    const b = bookQuote(4);
    expect(b.depositAmount).toBe(96);
    expect(toStripeAmount(b.depositAmount)).toBe(9600);
    expect(toStripeAmount(bookQuote(2).depositAmount)).toBe(7800);
  });

  it("charges nothing when the listing has no extra-guest fee", () => {
    expect(extraGuestCharge({ extraGuestFee: 0 }, 4, 3).total).toBe(0);
    expect(extraGuestCharge({}, 4, 3).total).toBe(0);
  });

  it("taxes the extra-guest charge as lodging", () => {
    const q = calculateQuote({
      property: motel,
      seasons: [],
      checkIn: new Date(checkIn + "T00:00:00"),
      checkOut: new Date(checkOut + "T00:00:00"),
      guests: 4,
      taxLiabilityAcknowledged: true,
      taxLines: [
        {
          name: "Lodging tax",
          ratePercent: 10,
          applyToLodging: true,
          applyToCleaning: false,
          applyToPetFee: false,
        },
      ],
    });
    expect(q.taxAmount).toBe(28.5); // 10% of 225 + 60
  });
});

describe("clampGuests", () => {
  it("flags a request above the listing max", () => {
    expect(clampGuests("9", 4)).toEqual({
      guests: 4,
      requested: 9,
      clamped: true,
    });
  });
  it("keeps counts within the max", () => {
    expect(clampGuests("3", 4)).toEqual({
      guests: 3,
      requested: 3,
      clamped: false,
    });
    expect(clampGuests("4", 4).clamped).toBe(false);
  });
  it("treats junk or missing as 1 guest without a notice", () => {
    expect(clampGuests(undefined, 4)).toEqual({
      guests: 1,
      requested: 1,
      clamped: false,
    });
    expect(clampGuests("abc", 4).clamped).toBe(false);
    expect(clampGuests("0", 4).guests).toBe(1);
  });
});

describe("invalid range on /book", () => {
  it("shows no fees and a $0 total when check-out is before check-in", () => {
    const q = calculateQuote({
      property: { ...motel, petsAllowed: true, petFee: 25 },
      seasons: [],
      checkIn: new Date("2030-03-07T00:00:00"),
      checkOut: new Date("2030-03-04T00:00:00"),
      guests: 4,
      pets: 1,
    });
    expect(q.error).toBe("Check-out must be after check-in");
    expect(q.cleaningFee).toBe(0);
    expect(q.extraGuestFee).toBe(0);
    expect(q.petFee).toBe(0);
    expect(q.taxAmount).toBe(0);
    expect(q.totalAmount).toBe(0);
    expect(q.depositAmount).toBe(0);
  });
});
