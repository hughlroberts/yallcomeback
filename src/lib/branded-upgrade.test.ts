import { describe, expect, it } from "vitest";
import {
  billingErrorMessage,
  brandedAwaitingPayment,
  brandedUpgradeConfirmPath,
  brandedUpgradeNeedsCheckout,
  canUpgradeToBranded,
  isBrandedUpgradeMetadata,
  safeBillingReturn,
} from "./branded-upgrade";

const market = { hostingMode: "PLATFORM", sitePresence: "STAYLOCAL" } as const;

describe("branded upgrade helpers (T38)", () => {
  it("only marketplace brands on the platform can upgrade", () => {
    expect(canUpgradeToBranded(market)).toBe(true);
    expect(canUpgradeToBranded({ ...market, sitePresence: "BOTH" })).toBe(false);
    expect(canUpgradeToBranded({ ...market, hostingMode: "SELF" })).toBe(false);
  });

  it("paid and no-plan brands need checkout; complimentary does not", () => {
    expect(brandedUpgradeNeedsCheckout(market, { monthlyPrice: 12 })).toBe(true);
    expect(brandedUpgradeNeedsCheckout(market, null)).toBe(true);
    expect(brandedUpgradeNeedsCheckout(market, { monthlyPrice: 0 })).toBe(false);
  });

  it("confirm path keeps only safe return paths", () => {
    expect(brandedUpgradeConfirmPath("h1", "/admin/brand")).toBe(
      "/account/settings/subscription/upgrade?hostId=h1&returnTo=%2Fadmin%2Fbrand",
    );
    expect(brandedUpgradeConfirmPath("h1", "https://evil.test")).toBe(
      "/account/settings/subscription/upgrade?hostId=h1",
    );
    expect(safeBillingReturn("//evil.test")).toBeNull();
    expect(safeBillingReturn("/marketplace")).toBeNull();
  });

  it("detects upgrade metadata", () => {
    expect(isBrandedUpgradeMetadata({ upgrade: "branded" })).toBe(true);
    expect(isBrandedUpgradeMetadata({ kind: "hosting_subscription" })).toBe(false);
    expect(isBrandedUpgradeMetadata(null)).toBe(false);
  });

  it("pending banner: branded, paid plan, not paid yet", () => {
    const branded = { ...market, sitePresence: "BOTH" as const };
    expect(
      brandedAwaitingPayment({ ...branded, subscriptionStatus: "PENDING_PAYMENT" }, { monthlyPrice: 25 }),
    ).toBe(true);
    expect(
      brandedAwaitingPayment({ ...branded, subscriptionStatus: "ACTIVE" }, { monthlyPrice: 25 }),
    ).toBe(false);
    expect(
      brandedAwaitingPayment({ ...branded, subscriptionStatus: "PENDING_PAYMENT" }, { monthlyPrice: 0 }),
    ).toBe(false);
    expect(
      brandedAwaitingPayment({ ...market, subscriptionStatus: "PENDING_PAYMENT" }, { monthlyPrice: 12 }),
    ).toBe(false);
  });

  it("every error code has a message", () => {
    for (const c of ["stripe_off", "price_missing", "no_email", "forbidden", "has_subscription", "not_marketplace", "not_branded", "failed"]) {
      expect(billingErrorMessage(c)).toBeTruthy();
    }
    expect(billingErrorMessage("nope")).toBeNull();
  });
});
