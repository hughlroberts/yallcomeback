import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_STAY_QUOTE_ERROR, calculateQuote } from "./pricing";
import { MAX_STAY_ERROR } from "./booking-quote";

const day = (s: string) => new Date(`${s}T00:00:00`);
const quote = (checkOut: string) =>
  calculateQuote({
    property: {
      baseNightlyRate: 150,
      defaultMinNights: 1,
      cleaningFee: 0,
      petFee: 0,
      petsAllowed: false,
      depositPercent: 30,
    },
    seasons: [],
    checkIn: day("2026-12-01"),
    checkOut: day(checkOut),
    taxLines: [],
  } as unknown as Parameters<typeof calculateQuote>[0]);
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("R1104-18 max stay on /book/{slug} and the mobile bar", () => {
  it("server quote: 90 nights prices, 91 nights is an error with no totals", () => {
    const ok = quote("2027-03-01");
    expect(ok.nights).toBe(90);
    expect(ok.error).toBeFalsy();
    expect(ok.totalAmount).toBeGreaterThan(0);
    const over = quote("2027-03-02");
    expect(over.error).toBe("Stays are limited to 90 nights");
    expect(over.error).toBe(MAX_STAY_QUOTE_ERROR);
    expect(MAX_STAY_QUOTE_ERROR).toBe(MAX_STAY_ERROR);
    expect(over.totalAmount).toBe(0);
    expect(over.depositAmount).toBe(0);
  });
  it("book page hides the quote/deposit and disables submit on that error", () => {
    const page = src("src/app/book/[slug]/page.tsx");
    expect(page).toMatch(/stayTooLong = quote\.error === MAX_STAY_QUOTE_ERROR/);
    expect(page).toMatch(/\{stayTooLong \? null : \(\s*<dl/);
    expect(page).toMatch(/\{stayTooLong \? null : \(\s*<div className="w-full rounded-2xl bg-bonnet/);
    expect(page).toMatch(/disabled=\{!available \|\| !!quote\.error/);
  });
  it("mobile sticky bar disables its button with the same check; widget unchanged", () => {
    const bar = src("src/components/mobile-reserve-bar.tsx");
    expect(bar).toMatch(/overMaxStay = bar\.error === MAX_STAY_ERROR/);
    expect(bar).toMatch(/disabled=\{overMaxStay\}/);
    const widget = src("src/components/booking-widget.tsx");
    expect(widget).toMatch(/disabled=\{overMaxStay\}/);
  });
});
