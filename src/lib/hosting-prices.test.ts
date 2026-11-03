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

import {
  BRANDED_PLAN_DESCRIPTION,
  planPublicDescription,
  stripLeadingPrice,
} from "./hosting-prices";

describe("stored plan descriptions never set the price copy (T43)", () => {
  const prodRow =
    "$$25 / month for the whole website — any number of listings. Brand site on your domain; marketplace listing included. Not a booking commission.";

  it("strips a leading price in the old and new formats", () => {
    for (const d of [
      prodRow,
      "$25 / month for the whole website — any number of listings.",
      "$25/mo for the whole website — any number of listings.",
      "$25 per month for the whole website — any number of listings.",
      "$25/mo + $1.06/mo card processing for the whole website — any number of listings.",
    ]) {
      expect(stripLeadingPrice(d)).toMatch(/^for the whole website — any number of listings\./);
    }
    expect(stripLeadingPrice("Brand site on your domain.")).toBe("Brand site on your domain.");
  });

  it("Branded plan: price from amount + fee, then the stored non-price text", () => {
    const out = planPublicDescription({ pricingModel: "FLAT", monthlyPrice: 25, description: prodRow });
    expect(out).toMatch(/^\$25\/mo \+ \$1\.06\/mo card processing for the whole website — any number of listings\./);
    expect(out).not.toMatch(/\/ month|\$\$/);
    expect(planPublicDescription({ pricingModel: "FLAT", monthlyPrice: 25, description: null })).toBe(
      "$25/mo + $1.06/mo card processing",
    );
  });

  it("other plans keep their text", () => {
    const d = "$12 per published listing / month. List on Find a Place.";
    expect(planPublicDescription({ pricingModel: "PER_PROPERTY", monthlyPrice: 12, description: d })).toBe(d);
    expect(planPublicDescription({ pricingModel: "FLAT", monthlyPrice: 0, description: "Complimentary" })).toBe("Complimentary");
  });

  it("seed text for new seeds uses the short form", () => {
    expect(BRANDED_PLAN_DESCRIPTION).toMatch(/^\$25\/mo for the whole website/);
    expect(planPublicDescription({ pricingModel: "FLAT", monthlyPrice: 25, description: BRANDED_PLAN_DESCRIPTION })).toMatch(
      /^\$25\/mo \+ \$1\.06\/mo card processing for the whole website/,
    );
  });
});
