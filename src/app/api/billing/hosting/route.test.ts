import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ prisma: { host: { findUnique: vi.fn() } } }));
const auth = vi.hoisted(() => ({ requireHostAdmin: vi.fn() }));
const stripe = vi.hoisted(() => ({ isStripeConfigured: vi.fn(() => true) }));
const billing = vi.hoisted(() => {
  class HostingBillingError extends Error {
    constructor(public code: string) {
      super(code);
    }
  }
  return {
    HostingBillingError,
    applyBrandedUpgrade: vi.fn(),
    billingPortalUrl: vi.fn(async () => "https://billing.stripe.test/p"),
    brandedUpgradeCheckoutUrl: vi.fn(async () => "https://checkout.stripe.test/u"),
    hostingSubscriptionUrl: vi.fn(async () => "https://checkout.stripe.test/s"),
  };
});
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/stripe", () => stripe);
vi.mock("@/lib/platform-billing", () => billing);
const mkt = vi.hoisted(() => ({
  marketplaceSubscriptionUrl: vi.fn(async () => "https://checkout.stripe.test/m"),
}));
const setup = vi.hoisted(() => ({
  setupServiceCheckoutUrl: vi.fn(async () => "https://checkout.stripe.test/setup"),
  setupServiceDone: (s: string) => s === "PAID" || s === "WAIVED",
}));
vi.mock("@/lib/marketplace-billing", () => mkt);
vi.mock("@/lib/setup-service", () => setup);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { NextRequest } from "next/server";
import { POST } from "./route";

const market = {
  id: "h1",
  slug: "qa",
  hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL",
  plan: { monthlyPrice: 12 },
  setupServiceStatus: "NONE",
};
const branded = { ...market, sitePresence: "BOTH", plan: { monthlyPrice: 25 } };

function post(fields: Record<string, string>, origin = "https://ycb.test") {
  const body = new URLSearchParams(fields);
  return new NextRequest("https://ycb.test/api/billing/hosting", {
    method: "POST",
    body,
    headers: {
      origin,
      host: "ycb.test",
      "content-type": "application/x-www-form-urlencoded",
    },
  });
}

describe("POST /api/billing/hosting (T38/T39)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripe.isStripeConfigured.mockReturnValue(true);
    auth.requireHostAdmin.mockResolvedValue({ isPlatform: false, hostId: "h1", hostAccess: "OWNER" });
    db.prisma.host.findUnique.mockResolvedValue(market);
  });

  it("upgrade: 303 to card checkout, no plan change", async () => {
    const res = await POST(post({ intent: "upgrade", hostId: "h1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/u");
    expect(billing.applyBrandedUpgrade).not.toHaveBeenCalled();
  });

  it("upgrade for a complimentary brand switches with no checkout", async () => {
    db.prisma.host.findUnique.mockResolvedValue({ ...market, plan: { monthlyPrice: 0 } });
    const res = await POST(post({ intent: "upgrade", hostId: "h1" }));
    expect(res.headers.get("location")).toBe("/account/settings/subscription?upgraded=website");
    expect(billing.applyBrandedUpgrade).toHaveBeenCalledWith("h1");
    expect(billing.brandedUpgradeCheckoutUrl).not.toHaveBeenCalled();
  });

  it("subscribe (Branded): 303 to checkout", async () => {
    db.prisma.host.findUnique.mockResolvedValue(branded);
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/s");
    expect(mkt.marketplaceSubscriptionUrl).not.toHaveBeenCalled();
  });

  it("subscribe (Marketplace, T45): 303 to the per-listing card checkout", async () => {
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/m");
    expect(billing.hostingSubscriptionUrl).not.toHaveBeenCalled();
  });

  it("setup (T45): 303 to the one-time card checkout, on any plan", async () => {
    for (const h of [market, branded]) {
      db.prisma.host.findUnique.mockResolvedValue(h);
      const res = await POST(post({ intent: "setup", hostId: "h1" }));
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("https://checkout.stripe.test/setup");
    }
  });

  it("setup already paid or waived: no second checkout", async () => {
    for (const status of ["PAID", "WAIVED"]) {
      db.prisma.host.findUnique.mockResolvedValue({ ...market, setupServiceStatus: status });
      const res = await POST(post({ intent: "setup", hostId: "h1" }));
      expect(res.headers.get("location")).toBe("/account/settings/subscription?billingError=setup_paid");
    }
    expect(setup.setupServiceCheckoutUrl).not.toHaveBeenCalled();
  });

  it("errors come back as a message on the subscription page, never a crash", async () => {
    db.prisma.host.findUnique.mockResolvedValueOnce(branded);
    billing.hostingSubscriptionUrl.mockRejectedValueOnce(new Error("stripe down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }));
    err.mockRestore();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/account/settings/subscription?billingError=failed");

    billing.brandedUpgradeCheckoutUrl.mockRejectedValueOnce(new billing.HostingBillingError("has_subscription"));
    const r2 = await POST(post({ intent: "upgrade", hostId: "h1" }));
    expect(r2.headers.get("location")).toBe("/account/settings/subscription?billingError=has_subscription");
  });

  it("Stripe not configured: back with a message", async () => {
    stripe.isStripeConfigured.mockReturnValue(false);
    const res = await POST(post({ intent: "upgrade", hostId: "h1" }));
    expect(res.headers.get("location")).toBe("/account/settings/subscription?billingError=stripe_off");
  });

  it("cross-site posts are refused", async () => {
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }, "https://evil.test"));
    expect(res.status).toBe(403);
    expect(billing.hostingSubscriptionUrl).not.toHaveBeenCalled();
  });

  it("signed out: to login", async () => {
    auth.requireHostAdmin.mockResolvedValue(null);
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }));
    expect(res.headers.get("location")).toMatch(/^\/login\?callbackUrl=/);
  });
});

describe("T38b: Waiting for payment → Pay now", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripe.isStripeConfigured.mockReturnValue(true);
    auth.requireHostAdmin.mockResolvedValue({ isPlatform: false, hostId: "h1", hostAccess: "OWNER" });
    db.prisma.host.findUnique.mockResolvedValue({
      ...market,
      sitePresence: "BOTH",
      subscriptionStatus: "PENDING_PAYMENT",
      plan: { monthlyPrice: 25, slug: "branded" },
    });
  });

  it("subscribe answers 303 straight to checkout", async () => {
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/s");
  });

  it("accepts same-site posts behind the proxy (x-forwarded-host)", async () => {
    const body = new URLSearchParams({ intent: "subscribe", hostId: "h1" });
    const req = new NextRequest("http://0.0.0.0:8080/api/billing/hosting", {
      method: "POST",
      body,
      headers: {
        origin: "https://www.yallcomeback.app",
        host: "0.0.0.0:8080",
        "x-forwarded-host": "www.yallcomeback.app",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.test/s");
  });

  it("a Stripe failure comes back with a readable billingError", async () => {
    billing.hostingSubscriptionUrl.mockRejectedValueOnce(new Error("timeout"));
    const res = await POST(post({ intent: "subscribe", hostId: "h1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "/account/settings/subscription?billingError=failed",
    );
  });
});
