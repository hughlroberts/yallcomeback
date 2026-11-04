import { describe, expect, it } from "vitest";
import {
  FREE_PLAN_NO_PAYMENT_LABEL,
  isFreePlanNoPaymentDue,
  subscriptionLabel,
} from "./hosting";

describe("free-plan subscription label", () => {
  it("shows free-plan wording for PENDING_PAYMENT on a $0 plan", () => {
    expect(subscriptionLabel("PENDING_PAYMENT", { monthlyPrice: 0 })).toBe(
      FREE_PLAN_NO_PAYMENT_LABEL,
    );
    expect(FREE_PLAN_NO_PAYMENT_LABEL).toBe("Free plan, no payment needed");
  });
  it("keeps awaiting-payment wording for paid plans or no plan", () => {
    expect(subscriptionLabel("PENDING_PAYMENT", { monthlyPrice: 2500 })).toBe(
      "Awaiting hosting payment",
    );
    expect(subscriptionLabel("PENDING_PAYMENT", null)).toBe(
      "Awaiting hosting payment",
    );
    expect(subscriptionLabel("PENDING_PAYMENT")).toBe("Awaiting hosting payment");
  });
  it("does not change other statuses on a $0 plan", () => {
    expect(subscriptionLabel("ACTIVE", { monthlyPrice: 0 })).toBe("Active");
    expect(subscriptionLabel("PAST_DUE", { monthlyPrice: 0 })).toBe("Past due");
    expect(isFreePlanNoPaymentDue("ACTIVE", { monthlyPrice: 0 })).toBe(false);
  });
});

import { planSummaryLabel } from "./hosting";

describe("planSummaryLabel (R1104-7)", () => {
  const fm = (n: number) => `$${n.toFixed(2)}`;
  it("complimentary reads plainly, no nested parens or trailing badge", () => {
    const s = planSummaryLabel(
      { name: "Complimentary", monthlyPrice: 0, pricingModel: "FLAT", currency: "usd" } as never,
      fm,
    );
    expect(s).toBe("Complimentary (never billed)");
    expect(s).not.toMatch(/\(.*\(|free$/i);
  });
  it("paid plans keep name and price", () => {
    expect(
      planSummaryLabel(
        { name: "Branded", monthlyPrice: 25, pricingModel: "FLAT", currency: "usd" } as never,
        fm,
      ),
    ).toBe("Branded · $25.00/mo total (whole website)");
    expect(
      planSummaryLabel(
        { name: "Per stay", monthlyPrice: 10, pricingModel: "PER_PROPERTY", currency: "usd" } as never,
        fm,
      ),
    ).toBe("Per stay · $10.00/listing/mo");
  });
});
