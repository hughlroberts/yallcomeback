import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    host: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    hostingPlan: { findFirst: vi.fn() },
  },
}));
const stripe = vi.hoisted(() => {
  const client = {
    prices: { retrieve: vi.fn(async () => ({ unit_amount: 2500, currency: "usd" })) },
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
    customers: { create: vi.fn() },
    paymentMethods: { list: vi.fn(async () => ({ data: [] })) },
    subscriptions: { retrieve: vi.fn() },
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
  HostingBillingError,
  applyHostingCheckoutSession,
  brandedUpgradeCheckoutUrl,
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

  it("refuses a second subscription next to a live one", async () => {
    await expect(
      brandedUpgradeCheckoutUrl({ ...marketHost, stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "active" }),
    ).rejects.toBeInstanceOf(HostingBillingError);
    expect(stripe.client.checkout.sessions.create).not.toHaveBeenCalled();
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
});
