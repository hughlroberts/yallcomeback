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

  it("formats short and long labels", () => {
    expect(brandedPriceLabel()).toBe("$25/mo + $1.06/mo card processing");
    expect(brandedPriceLabel("long")).toBe(
      "$25 / month + $1.06 / month card processing",
    );
    expect(cardProcessingNote()).toBe("$1.06/mo card processing");
  });

  it("follows the fee env the checkout uses", () => {
    vi.stubEnv("STRIPE_PERCENT_BPS", "0");
    vi.stubEnv("STRIPE_FIXED_FEE_CENTS", "0");
    expect(brandedPriceLabel()).toBe("$25/mo");
  });
});
