import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_STAY_ERROR, computeBookingQuote } from "./booking-quote";

const base = {
  checkIn: "2026-12-01",
  checkOut: "2027-03-01", // 90 nights
  nightlyRate: 100,
  weekendRate: null,
  defaultMinNights: 1,
  cleaningFee: 0,
  depositPercent: 25,
  seasons: [],
  blocked: new Set<string>(),
} as unknown as Parameters<typeof computeBookingQuote>[0];

describe("R1104-18 widget max stay", () => {
  it("quotes 90 nights but rejects 91 with the shared message", () => {
    const ok = computeBookingQuote(base)!;
    expect(ok.nights).toBe(90);
    expect(ok.error).toBeUndefined();
    const over = computeBookingQuote({ ...base, checkOut: "2027-03-02" })!;
    expect(over.error).toBe("Stays are limited to 90 nights");
    expect(over.error).toBe(MAX_STAY_ERROR);
    expect(over.nights).toBe(91);
  });
  it("disables the book button when the quote has an error (max stay or past)", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/booking-widget.tsx"),
      "utf8",
    );
    expect(src).toMatch(/const quoteBlocked = Boolean/);
    expect(src).toMatch(/disabled=\{quoteBlocked\}/);
  });
});
