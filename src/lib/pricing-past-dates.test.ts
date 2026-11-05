import { describe, expect, it } from "vitest";
import { calculateQuote, PAST_DATES_QUOTE_ERROR } from "./pricing";

const property = {
  baseNightlyRate: 100,
  defaultMinNights: 1,
  cleaningFee: 50,
  petFee: 0,
  petsAllowed: false,
  depositPercent: 30,
};

describe("calculateQuote past dates (E1104-C1)", () => {
  it("rejects past check-in with empty totals", () => {
    const q = calculateQuote({
      property,
      seasons: [],
      checkIn: new Date("2025-01-01T00:00:00"),
      checkOut: new Date("2025-01-04T00:00:00"),
    });
    expect(q.error).toBe(PAST_DATES_QUOTE_ERROR);
    expect(q.nights).toBe(3);
    expect(q.totalAmount).toBe(0);
    expect(q.depositAmount).toBe(0);
  });
});
