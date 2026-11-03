import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    host: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    hostingPlan: { findFirst: vi.fn<(...a: unknown[]) => Promise<{ id: string } | null>>(async () => null) },
  },
}));
const stripe = vi.hoisted(() => {
  const client = {
    prices: { retrieve: vi.fn(async () => ({ unit_amount: 2500, currency: "usd" })) },
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
    customers: {
      create: vi.fn(),
      retrieve: vi.fn(async () => ({ invoice_settings: { default_payment_method: "pm_1" } })),
      update: vi.fn(),
    },
    paymentMethods: { list: vi.fn(async () => ({ data: [] })) },
    subscriptions: { retrieve: vi.fn(), cancel: vi.fn() },
  };
  return {
    client,
    mod: {
      CARD_PROCESSING_LINE: "Card processing",
      getStripe: () => client,
      hostingPriceId: vi.fn(() => "price_test"),
      processingFeeToNetCents: () => 0,
      requireStripeClient: () => client,
    },
  };
});
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/stripe", () => stripe.mod);
vi.mock("@/lib/features", () => ({ canonicalSiteOrigin: () => "https://ycb.test" }));

import {
  applyHostingCheckoutSession,
  applyHostingSubscriptionFromStripe,
  brandedUpgradeCheckoutUrl,
  endReplacedSubscription,
} from "./platform-billing";

const marketHost = {
  id: "h1",
  name: "QA",
  slug: "qa",
  stripeCustomerId: "cus_1",
  contactEmail: "qa@example.com",
  billingEmail: null,
  hostingMode: "PLATFORM" as const,
  sitePresence: "STAYLOCAL" as const,
  sitePublishState: "DEMO",
  subscriptionStatus: "ACTIVE",
  stripeSubscriptionId: null,
  stripeSubscriptionStatus: null,
  planId: "plan_market",
  plan: { monthlyPrice: 12, slug: "marketplace" },
};

describe("Marketplace → Branded checkout (T38)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripe.client.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
    db.prisma.hostingPlan.findFirst.mockResolvedValue({ id: "plan_branded" });
    db.prisma.host.update.mockImplementation(async ({ data }) => ({ ...marketHost, ...data }));
  });

  it("starting the upgrade only creates checkout; the host does not change", async () => {
    const url = await brandedUpgradeCheckoutUrl(marketHost);
    expect(url).toBe("https://checkout.stripe.test/s");
    expect(db.prisma.host.update).not.toHaveBeenCalled();
    const args = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(args.metadata).toEqual({ kind: "hosting_subscription", hostId: "h1", upgrade: "branded" });
    expect(args.subscription_data.metadata.upgrade).toBe("branded");
    expect(args.cancel_url).toBe("https://ycb.test/account/settings/subscription?canceled=1&upgrade=branded");
    expect(args.success_url).toContain("upgrade=branded");
  });

  it("T45: with a live Marketplace card subscription, the checkout names it to be replaced", async () => {
    const url = await brandedUpgradeCheckoutUrl({
      ...marketHost,
      stripeSubscriptionId: "sub_old",
      stripeSubscriptionStatus: "active",
    });
    expect(url).toBe("https://checkout.stripe.test/s");
    const args = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(args.metadata.replacesSubscription).toBe("sub_old");
    expect(args.subscription_data.metadata.replacesSubscription).toBe("sub_old");
    // Nothing is canceled before the new plan is paid.
    expect(stripe.client.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("no live subscription: nothing to replace", async () => {
    await brandedUpgradeCheckoutUrl(marketHost);
    const args = stripe.client.checkout.sessions.create.mock.calls[0][0];
    expect(args.metadata.replacesSubscription).toBeUndefined();
  });

  it("a paid upgrade session switches the brand to Branded + branded plan", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      metadata: { kind: "hosting_subscription", hostId: "h1", upgrade: "branded" },
      customer: null,
      subscription: "sub_new",
    });
    db.prisma.host.findUnique.mockResolvedValue(marketHost);
    await applyHostingCheckoutSession({ sessionId: "cs_test_1" });
    const first = db.prisma.host.update.mock.calls[0][0];
    expect(first.data).toMatchObject({ sitePresence: "BOTH", planId: "plan_branded", listOnMarketplace: true });
  });

  it("an unpaid (open) upgrade session changes nothing about the plan", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      status: "open",
      payment_status: "unpaid",
      metadata: { kind: "hosting_subscription", hostId: "h1", upgrade: "branded" },
      customer: null,
      subscription: null,
    });
    db.prisma.host.findUnique.mockResolvedValue(marketHost);
    await applyHostingCheckoutSession({ sessionId: "cs_test_2" });
    for (const [arg] of db.prisma.host.update.mock.calls) {
      expect(arg.data.sitePresence).toBeUndefined();
      expect(arg.data.planId).toBeUndefined();
    }
  });

  it("T45: a paid upgrade ends the old Marketplace subscription with credit, once", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      status: "complete",
      payment_status: "paid",
      metadata: { kind: "hosting_subscription", hostId: "h1", upgrade: "branded", replacesSubscription: "sub_old" },
      customer: "cus_1",
      subscription: "sub_new",
    });
    stripe.client.subscriptions.retrieve.mockResolvedValue({ id: "sub_old", status: "active", customer: "cus_1" });
    db.prisma.host.findUnique.mockResolvedValue({ ...marketHost, stripeSubscriptionId: "sub_old" });
    await applyHostingCheckoutSession({ sessionId: "cs_test_3" });
    expect(stripe.client.subscriptions.cancel).toHaveBeenCalledWith("sub_old", { prorate: true, invoice_now: true });

    // Second delivery (webhook after the success page): already canceled → no second cancel.
    stripe.client.subscriptions.cancel.mockClear();
    stripe.client.subscriptions.retrieve.mockResolvedValue({ id: "sub_old", status: "canceled", customer: "cus_1" });
    await applyHostingCheckoutSession({ sessionId: "cs_test_3" });
    expect(stripe.client.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("T45: an unpaid upgrade never ends the old subscription", async () => {
    stripe.client.checkout.sessions.retrieve.mockResolvedValue({
      status: "open",
      payment_status: "unpaid",
      metadata: { kind: "hosting_subscription", hostId: "h1", upgrade: "branded", replacesSubscription: "sub_old" },
      customer: "cus_1",
      subscription: null,
    });
    db.prisma.host.findUnique.mockResolvedValue(marketHost);
    await applyHostingCheckoutSession({ sessionId: "cs_test_4" });
    expect(stripe.client.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.client.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe("endReplacedSubscription (T45)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuses a subscription that belongs to a different customer", async () => {
    stripe.client.subscriptions.retrieve.mockResolvedValue({ id: "sub_x", status: "active", customer: "cus_other" });
    expect(await endReplacedSubscription("sub_x", "cus_1")).toBe(false);
    expect(stripe.client.subscriptions.cancel).not.toHaveBeenCalled();
  });

  it("treats a missing subscription as already ended", async () => {
    stripe.client.subscriptions.retrieve.mockRejectedValue(new Error("No such subscription: 'sub_gone'"));
    expect(await endReplacedSubscription("sub_gone", "cus_1")).toBe(true);
  });
});

describe("T46: grace date follows the card subscription", () => {
  const expired = new Date("2026-10-01T00:00:00Z");
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.host.update.mockImplementation(async ({ data }) => ({ ...marketHost, ...data }));
  });

  it("resubscribe (active): clears the old expired grace date and the hide", async () => {
    db.prisma.host.findUnique.mockResolvedValue({
      ...marketHost,
      marketplaceGraceEndsAt: expired,
      marketplaceSuspendedAt: expired,
      plan: { monthlyPrice: 12, slug: "marketplace" },
    });
    await applyHostingSubscriptionFromStripe({ hostId: "h1", subscriptionId: "sub_new", stripeStatus: "active" });
    const data = db.prisma.host.update.mock.calls[0][0].data;
    expect(data.marketplaceGraceEndsAt).toBeNull();
    expect(data.marketplaceSuspendedAt).toBeNull();
  });

  it("subscription ends: a fresh 14-day window, not the old date", async () => {
    db.prisma.host.findUnique.mockResolvedValue({
      ...marketHost,
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
      marketplaceGraceEndsAt: expired,
    });
    const before = Date.now();
    await applyHostingSubscriptionFromStripe({ hostId: "h1", subscriptionId: "sub_1", stripeStatus: "canceled" });
    const data = db.prisma.host.update.mock.calls[0][0].data;
    const ends = (data.marketplaceGraceEndsAt as Date).getTime();
    expect(ends).toBeGreaterThanOrEqual(before + 14 * 86400000 - 1000);
    expect(data.marketplaceSuspendedAt).toBeNull();
    expect(data.stripeSubscriptionId).toBeNull();
  });

  it("a replayed cancel after the sub id is gone does not restart the window", async () => {
    db.prisma.host.findUnique.mockResolvedValue({
      ...marketHost,
      stripeSubscriptionId: null,
      stripeSubscriptionStatus: "canceled",
      marketplaceGraceEndsAt: expired,
    });
    await applyHostingSubscriptionFromStripe({ hostId: "h1", subscriptionId: "sub_1", stripeStatus: "canceled" });
    const data = db.prisma.host.update.mock.calls[0][0].data;
    expect("marketplaceGraceEndsAt" in data).toBe(false);
  });

  it("past_due keeps the dates as they are", async () => {
    db.prisma.host.findUnique.mockResolvedValue({
      ...marketHost,
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
      marketplaceGraceEndsAt: expired,
    });
    await applyHostingSubscriptionFromStripe({ hostId: "h1", subscriptionId: "sub_1", stripeStatus: "past_due" });
    const data = db.prisma.host.update.mock.calls[0][0].data;
    expect("marketplaceGraceEndsAt" in data).toBe(false);
  });
});
