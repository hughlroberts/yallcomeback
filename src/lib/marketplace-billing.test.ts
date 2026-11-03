import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    host: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    property: { findMany: vi.fn() },
    hostingPlan: { findFirst: vi.fn() },
  },
}));
const s = vi.hoisted(() => {
  const calls: string[] = [];
  const client = {
    subscriptions: { retrieve: vi.fn() },
    subscriptionItems: {
      create: vi.fn<(a: Record<string, unknown>) => Promise<object>>(async () => { calls.push("create"); return {}; }),
      update: vi.fn<(id: string, a: Record<string, unknown>) => Promise<object>>(async () => { calls.push("update"); return {}; }),
      del: vi.fn(async () => { calls.push("del"); return {}; }),
      list: vi.fn(),
    },
    products: {
      retrieve: vi.fn(async (id: string) => ({ id, name: "x", active: true })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
    },
  };
  return { calls, client, configured: { on: true } };
});
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/stripe", () => ({
  getStripe: () => (s.configured.on ? s.client : null),
  isStripeConfigured: () => s.configured.on,
  requireStripeClient: () => s.client,
}));
vi.mock("@/lib/features", () => ({ canonicalSiteOrigin: () => "https://ycb.test" }));
vi.mock("@/lib/platform-billing", () => ({
  HostingBillingError: class extends Error {},
  createPlatformBillingPortalSession: vi.fn(),
  ensurePlatformCustomer: vi.fn(async () => "cus_1"),
}));

import { runMarketplaceGraceJob, syncMarketplaceSubscriptionItems } from "./marketplace-billing";

const NOW = new Date("2026-11-03T22:00:00Z");
const base = {
  hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL",
  stripeSubscriptionId: null,
  stripeSubscriptionStatus: null,
  marketplaceGraceEndsAt: null,
  marketplaceSuspendedAt: null,
  plan: { monthlyPrice: 12 },
};

describe("runMarketplaceGraceJob (T45)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.configured.on = true;
    db.prisma.host.updateMany.mockResolvedValue({ count: 1 });
    db.prisma.host.findUnique.mockResolvedValue(null);
  });

  it("does nothing when Stripe is off", async () => {
    s.configured.on = false;
    expect((await runMarketplaceGraceJob(NOW)).skipped).toBe(true);
    expect(db.prisma.host.findMany).not.toHaveBeenCalled();
  });

  it("starts 14 days of grace, hides after it ends, shows again once paid", async () => {
    db.prisma.host.findMany.mockResolvedValue([
      { ...base, id: "a", slug: "new-grace" },
      { ...base, id: "b", slug: "expired", marketplaceGraceEndsAt: new Date("2026-11-01T00:00:00Z") },
      {
        ...base,
        id: "c",
        slug: "paid",
        stripeSubscriptionId: "sub_c",
        stripeSubscriptionStatus: "active",
        marketplaceSuspendedAt: new Date("2026-10-30T00:00:00Z"),
      },
      { ...base, id: "d", slug: "still-in-grace", marketplaceGraceEndsAt: new Date("2026-11-10T00:00:00Z") },
      { ...base, id: "e", slug: "branded", sitePresence: "CUSTOM" },
      { ...base, id: "f", slug: "free", plan: { monthlyPrice: 0 } },
    ]);
    const r = await runMarketplaceGraceJob(NOW);
    expect(r.graceStarted).toBe(1);
    expect(r.suspended).toEqual(["expired"]);
    expect(r.restored).toEqual(["paid"]);
    const calls = db.prisma.host.updateMany.mock.calls.map((c) => c[0]);
    expect(calls).toContainEqual({
      where: { id: "a", marketplaceGraceEndsAt: null },
      data: { marketplaceGraceEndsAt: new Date(NOW.getTime() + 14 * 86400000) },
    });
    expect(calls).toContainEqual({
      where: { id: "b", marketplaceSuspendedAt: null },
      data: { marketplaceSuspendedAt: NOW },
    });
    expect(calls).toContainEqual({
      where: { id: "c", marketplaceSuspendedAt: { not: null } },
      data: { marketplaceSuspendedAt: null },
    });
    // Nobody else is touched.
    expect(calls.map((c) => c.where.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("syncMarketplaceSubscriptionItems (T45)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    s.calls.length = 0;
    s.configured.on = true;
    db.prisma.host.findUnique.mockResolvedValue({
      ...base,
      id: "h1",
      slug: "qa",
      stripeSubscriptionId: "sub_1",
      stripeSubscriptionStatus: "active",
    });
  });

  function sub(items: { id: string; product: string; name: string; cents: number }[]) {
    return {
      id: "sub_1",
      status: "active",
      currency: "usd",
      metadata: { product: "marketplace" },
      items: {
        has_more: false,
        data: items.map((i) => ({
          id: i.id,
          quantity: 1,
          price: { unit_amount: i.cents, product: { id: i.product, name: i.name } },
        })),
      },
    };
  }

  it("adds a newly published listing to the next bill only (no proration)", async () => {
    s.client.subscriptions.retrieve.mockResolvedValue(
      sub([
        { id: "si_1", product: "ycb_mkt_listing_p1", name: "Cabin", cents: 1200 },
        { id: "si_fee", product: "ycb_mkt_card_processing", name: "Card processing", cents: 65 },
      ]),
    );
    db.prisma.property.findMany.mockResolvedValue([
      { id: "p1", title: "Cabin", published: true, archivedAt: null },
      { id: "p2", title: "Loft", published: true, archivedAt: null },
    ]);
    const r = await syncMarketplaceSubscriptionItems("h1");
    expect(r).toMatchObject({ status: "synced", added: 1, removed: 0 });
    const created = s.client.subscriptionItems.create.mock.calls.map((c) => c[0]);
    expect(created[0]).toMatchObject({
      subscription: "sub_1",
      proration_behavior: "none",
      price_data: { unit_amount: 1200, product: "ycb_mkt_listing_p2" },
    });
    for (const c of [...s.client.subscriptionItems.update.mock.calls]) {
      expect(c[1]).toMatchObject({ proration_behavior: "none" });
    }
  });

  it("removes a paused listing before adding, keeping under the item limit", async () => {
    s.client.subscriptions.retrieve.mockResolvedValue(
      sub([
        { id: "si_1", product: "ycb_mkt_listing_p1", name: "Cabin", cents: 1200 },
        { id: "si_2", product: "ycb_mkt_listing_p2", name: "Loft", cents: 1200 },
        { id: "si_fee", product: "ycb_mkt_card_processing", name: "Card processing", cents: 102 },
      ]),
    );
    db.prisma.property.findMany.mockResolvedValue([
      { id: "p1", title: "Cabin", published: true, archivedAt: null },
      { id: "p2", title: "Loft", published: false, archivedAt: null },
      { id: "p3", title: "Barn", published: true, archivedAt: null },
    ]);
    await syncMarketplaceSubscriptionItems("h1");
    expect(s.client.subscriptionItems.del).toHaveBeenCalledWith("si_2", { proration_behavior: "none" });
    expect(s.calls[0]).toBe("del");
  });

  it("never edits a subscription it did not make", async () => {
    s.client.subscriptions.retrieve.mockResolvedValue({ ...sub([]), metadata: { product: "website" } });
    const r = await syncMarketplaceSubscriptionItems("h1");
    expect(r).toEqual({ status: "skipped", reason: "not_marketplace_subscription" });
    expect(s.calls).toEqual([]);
  });
});
