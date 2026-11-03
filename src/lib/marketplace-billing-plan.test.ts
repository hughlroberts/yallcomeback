import { describe, expect, it } from "vitest";
import {
  ADDITIONAL_LISTINGS_PRODUCT_ID,
  MARKETPLACE_FEE_PRODUCT_ID,
  MAX_SUBSCRIPTION_ITEMS,
  MINIMUM_LISTING_PRODUCT_ID,
  desiredMarketplaceLines,
  hasLiveCardSubscription,
  marketplaceCardState,
  marketplaceFeeCents,
  marketplaceGraceEndFrom,
  marketplaceGracePatchForStatus,
  marketplaceListingProductId,
  marketplaceNeedsCard,
  marketplaceUnitCents,
  planMarketplaceItemSync,
  shouldRestoreMarketplace,
  shouldSuspendMarketplace,
  type CurrentItem,
  type MarketplaceGraceHost,
} from "./marketplace-billing-plan";

const listing = (id: string, extra: Partial<{ title: string; published: boolean; archivedAt: Date | null }> = {}) => ({
  id,
  title: extra.title ?? `Cabin ${id}`,
  published: extra.published ?? true,
  archivedAt: extra.archivedAt ?? null,
});

describe("Marketplace lines (T45)", () => {
  it("one named $12 line per published listing; drafts and archived are not billed", () => {
    const lines = desiredMarketplaceLines(
      [listing("a"), listing("b", { published: false }), listing("c", { archivedAt: new Date() })],
      1200,
    );
    expect(lines).toEqual([
      { productId: marketplaceListingProductId("a"), name: "Marketplace listing: Cabin a", unitCents: 1200, quantity: 1, propertyId: "a" },
    ]);
  });

  it("no published listing bills the 1 listing minimum", () => {
    const lines = desiredMarketplaceLines([], 1200);
    expect(lines).toHaveLength(1);
    expect(lines[0].productId).toBe(MINIMUM_LISTING_PRODUCT_ID);
  });

  it("19 listings: all named (19 + fee = 20 items)", () => {
    const many = Array.from({ length: 19 }, (_, i) => listing(`p${String(i).padStart(2, "0")}`));
    const lines = desiredMarketplaceLines(many, 1200);
    expect(lines).toHaveLength(19);
    expect(lines.every((l) => l.quantity === 1)).toBe(true);
  });

  it("over 19 listings: 18 named + 1 'additional' line, never over Stripe's 20 items", () => {
    const many = Array.from({ length: 30 }, (_, i) => listing(`p${String(i).padStart(2, "0")}`));
    const lines = desiredMarketplaceLines(many, 1200);
    expect(lines).toHaveLength(19);
    expect(lines.length + 1).toBeLessThanOrEqual(MAX_SUBSCRIPTION_ITEMS);
    const extra = lines.at(-1)!;
    expect(extra.productId).toBe(ADDITIONAL_LISTINGS_PRODUCT_ID);
    expect(extra.quantity).toBe(12);
    expect(lines.reduce((s, l) => s + l.quantity, 0)).toBe(30);
  });

  it("card processing uses the Branded formula on the whole bill", () => {
    expect(marketplaceFeeCents([{ unitCents: 1200, quantity: 1 }])).toBe(67);
    expect(marketplaceFeeCents([{ unitCents: 1200, quantity: 3 }])).toBe(
      marketplaceFeeCents([{ unitCents: 3600, quantity: 1 }]),
    );
  });

  it("a $0 or missing plan uses the $12 published price", () => {
    expect(marketplaceUnitCents(0)).toBe(1200);
    expect(marketplaceUnitCents(null)).toBe(1200);
    expect(marketplaceUnitCents(15)).toBe(1500);
  });
});

describe("planMarketplaceItemSync (T45)", () => {
  const item = (id: string, productId: string, unitCents: number, quantity = 1, productName: string | null = null): CurrentItem => ({
    id,
    productId,
    productName,
    unitCents,
    quantity,
  });

  it("adds a newly published listing and raises the fee", () => {
    const desired = desiredMarketplaceLines([listing("a"), listing("b")], 1200);
    const current = [
      item("si_a", marketplaceListingProductId("a"), 1200, 1, "Marketplace listing: Cabin a"),
      item("si_fee", MARKETPLACE_FEE_PRODUCT_ID, 67),
    ];
    const plan = planMarketplaceItemSync(current, desired);
    expect(plan.add.map((l) => l.propertyId)).toEqual(["b"]);
    expect(plan.remove).toEqual([]);
    expect(plan.fee).toEqual({ action: "update", itemId: "si_fee", cents: marketplaceFeeCents(desired) });
    expect(plan.noop).toBe(false);
  });

  it("removes an archived listing; the last one falls back to the minimum line", () => {
    const desired = desiredMarketplaceLines([], 1200);
    const current = [
      item("si_a", marketplaceListingProductId("a"), 1200),
      item("si_fee", MARKETPLACE_FEE_PRODUCT_ID, 67),
    ];
    const plan = planMarketplaceItemSync(current, desired);
    expect(plan.remove).toEqual(["si_a"]);
    expect(plan.add.map((l) => l.productId)).toEqual([MINIMUM_LISTING_PRODUCT_ID]);
    expect(plan.fee.action).toBe("keep");
  });

  it("renames when a listing title changes", () => {
    const desired = desiredMarketplaceLines([listing("a", { title: "Dock House" })], 1200);
    const current = [
      item("si_a", marketplaceListingProductId("a"), 1200, 1, "Marketplace listing: Old name"),
      item("si_fee", MARKETPLACE_FEE_PRODUCT_ID, 67),
    ];
    const plan = planMarketplaceItemSync(current, desired);
    expect(plan.rename).toEqual([{ productId: marketplaceListingProductId("a"), name: "Marketplace listing: Dock House" }]);
  });

  it("is a no-op when Stripe already matches (idempotent)", () => {
    const desired = desiredMarketplaceLines([listing("a")], 1200);
    const current = [
      item("si_a", marketplaceListingProductId("a"), 1200, 1, "Marketplace listing: Cabin a"),
      item("si_fee", MARKETPLACE_FEE_PRODUCT_ID, 67),
    ];
    expect(planMarketplaceItemSync(current, desired).noop).toBe(true);
  });

  it("changes the quantity of the 'additional' line", () => {
    const desired = desiredMarketplaceLines(
      Array.from({ length: 21 }, (_, i) => listing(`p${String(i).padStart(2, "0")}`)),
      1200,
    );
    const current = desired
      .filter((l) => l.productId !== ADDITIONAL_LISTINGS_PRODUCT_ID)
      .map((l, i) => item(`si_${i}`, l.productId, 1200, 1, l.name));
    current.push(item("si_extra", ADDITIONAL_LISTINGS_PRODUCT_ID, 1200, 2, null));
    const plan = planMarketplaceItemSync(current, desired);
    expect(plan.reprice).toEqual([{ itemId: "si_extra", line: expect.objectContaining({ quantity: 3 }) }]);
  });

  it("leaves items it did not make alone and removes duplicate fee lines", () => {
    const desired = desiredMarketplaceLines([listing("a")], 1200);
    const current = [
      item("si_a", marketplaceListingProductId("a"), 1200),
      item("si_fee", MARKETPLACE_FEE_PRODUCT_ID, 67),
      item("si_fee2", MARKETPLACE_FEE_PRODUCT_ID, 67),
      item("si_other", "prod_someone_else", 500),
    ];
    const plan = planMarketplaceItemSync(current, desired);
    expect(plan.remove).toEqual(["si_fee2"]);
  });
});

describe("Marketplace grace and suspension (T45)", () => {
  const now = new Date("2026-11-03T21:00:00Z");
  const base: MarketplaceGraceHost = {
    hostingMode: "PLATFORM",
    sitePresence: "STAYLOCAL",
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    marketplaceGraceEndsAt: null,
    marketplaceSuspendedAt: null,
    plan: { monthlyPrice: 12 },
  };

  it("only paid Marketplace brands with no card subscription need a card", () => {
    expect(marketplaceNeedsCard(base)).toBe(true);
    expect(marketplaceNeedsCard({ ...base, plan: { monthlyPrice: 0 } })).toBe(false);
    expect(marketplaceNeedsCard({ ...base, sitePresence: "BOTH" })).toBe(false);
    expect(marketplaceNeedsCard({ ...base, hostingMode: "SELF" })).toBe(false);
    expect(marketplaceNeedsCard({ ...base, stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "active" })).toBe(false);
    expect(marketplaceNeedsCard({ ...base, stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "canceled" })).toBe(true);
  });

  it("past_due still counts as a card on file (the past-due banner handles it)", () => {
    expect(hasLiveCardSubscription({ stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "past_due" })).toBe(true);
    expect(hasLiveCardSubscription({ stripeSubscriptionId: null, stripeSubscriptionStatus: "active" })).toBe(false);
  });

  it("grace is 14 days and counts down", () => {
    const endsAt = marketplaceGraceEndFrom(now);
    expect(endsAt.toISOString()).toBe("2026-11-17T21:00:00.000Z");
    expect(marketplaceCardState({ ...base, marketplaceGraceEndsAt: endsAt }, now)).toEqual({
      kind: "grace",
      endsAt,
      daysLeft: 14,
    });
    expect(marketplaceCardState(base, now)).toEqual({ kind: "grace_unset" });
  });

  it("suspends only after grace ends, never without a stamped grace", () => {
    const endsAt = marketplaceGraceEndFrom(now);
    expect(shouldSuspendMarketplace(base, now)).toBe(false);
    expect(shouldSuspendMarketplace({ ...base, marketplaceGraceEndsAt: endsAt }, now)).toBe(false);
    const later = new Date(endsAt.getTime() + 1000);
    expect(shouldSuspendMarketplace({ ...base, marketplaceGraceEndsAt: endsAt }, later)).toBe(true);
    expect(
      shouldSuspendMarketplace({ ...base, marketplaceGraceEndsAt: endsAt, marketplaceSuspendedAt: later }, later),
    ).toBe(false);
  });

  it("paying restores the listings", () => {
    const suspended = { ...base, marketplaceGraceEndsAt: now, marketplaceSuspendedAt: now };
    expect(shouldRestoreMarketplace(suspended)).toBe(false);
    expect(
      shouldRestoreMarketplace({ ...suspended, stripeSubscriptionId: "sub_1", stripeSubscriptionStatus: "active" }),
    ).toBe(true);
    expect(marketplaceCardState(suspended, now)).toEqual({ kind: "suspended", since: now });
  });
});

describe("marketplaceGracePatchForStatus (T46)", () => {
  const now = new Date("2026-11-03T12:00:00Z");
  const market = {
    hostingMode: "PLATFORM" as const,
    sitePresence: "STAYLOCAL" as "STAYLOCAL" | "CUSTOM" | "BOTH",
    stripeSubscriptionId: "sub_1" as string | null,
  };
  it("active or trialing clears grace and hide", () => {
    for (const s of ["active", "trialing", "ACTIVE"]) {
      expect(marketplaceGracePatchForStatus(market, s, now)).toEqual({
        marketplaceGraceEndsAt: null,
        marketplaceSuspendedAt: null,
      });
    }
  });
  it("ended subscription starts a fresh 14 days", () => {
    for (const s of ["canceled", "incomplete_expired"]) {
      expect(marketplaceGracePatchForStatus(market, s, now)).toEqual({
        marketplaceGraceEndsAt: new Date(now.getTime() + 14 * 86400000),
        marketplaceSuspendedAt: null,
      });
    }
  });
  it("no change for replays, Branded, or other statuses", () => {
    expect(marketplaceGracePatchForStatus({ ...market, stripeSubscriptionId: null }, "canceled", now)).toEqual({});
    expect(marketplaceGracePatchForStatus({ ...market, sitePresence: "CUSTOM" }, "canceled", now)).toEqual({});
    for (const s of ["past_due", "unpaid", "paused", null]) {
      expect(marketplaceGracePatchForStatus(market, s, now)).toEqual({});
    }
  });
});
