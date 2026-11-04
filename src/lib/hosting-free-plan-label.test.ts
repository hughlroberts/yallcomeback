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
