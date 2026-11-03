import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRANDED_WEBSITE_USD,
  brandedPriceLabel,
  cardProcessingNote,
  cardProcessingUsd,
} from "./hosting-prices";
import { processingFeeToNetCents } from "./stripe";

afterEach(() => vi.unstubAllEnvs());

describe("branded price copy", () => {
  it("matches the checkout's card processing line", () => {
    expect(cardProcessingUsd()).toBe(
      processingFeeToNetCents(BRANDED_WEBSITE_USD * 100) / 100,
    );
    expect(cardProcessingUsd()).toBe(1.06);
  });

  it("uses one short format everywhere (T43)", () => {
    expect(brandedPriceLabel()).toBe("$25/mo + $1.06/mo card processing");
    expect(brandedPriceLabel()).not.toMatch(/ \/ month/);
    const fee30 = processingFeeToNetCents(3000) / 100;
    expect(brandedPriceLabel(30)).toBe(`$30/mo + $${fee30.toFixed(2)}/mo card processing`);
    expect(cardProcessingNote()).toBe("$1.06/mo card processing");
  });

  it("follows the fee env the checkout uses", () => {
    vi.stubEnv("STRIPE_PERCENT_BPS", "0");
    vi.stubEnv("STRIPE_FIXED_FEE_CENTS", "0");
    expect(brandedPriceLabel()).toBe("$25/mo");
  });
});
