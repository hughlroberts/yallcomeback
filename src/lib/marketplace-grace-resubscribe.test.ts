/**
 * T46 follow-up (Tester): cancel, then resubscribe, a Marketplace card
 * subscription, and what happens to the 14-day grace period.
 *
 * Drives the real webhook handler (applyHostingSubscriptionFromStripe), the
 * real grace job (runMarketplaceGraceJob) and the real banner state
 * (marketplaceCardState) against one in-memory brand row, so the whole
 * sequence is checked end to end, not one function at a time.
 *
 * Behavior documented here:
 * - Cancel (subscription ended) starts a fresh 14 days from the cancel.
 *   Listings stay visible during those 14 days.
 * - A replay of the same cancel event does not restart the 14 days.
 * - Resubscribe (new subscription active) clears the grace date and any
 *   hide at once.
 * - Cancel again later: a NEW full 14 days from that second cancel. The old
 *   date is never reused, and the clock does not continue where it stopped.
 * - A late "canceled" event for the OLD subscription after the resubscribe
 *   is ignored (the new subscription stays, no grace starts).
 * - Grace runs out with no card: listings hidden. Resubscribe shows them
 *   again. A later cancel gives a fresh 14 days with listings visible.
 * - Cancel at period end: nothing changes until Stripe ends the subscription.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const store = vi.hoisted(() => ({ row: {} as Record<string, unknown> }));

function matches(row: Row, where: Row): boolean {
  for (const [key, cond] of Object.entries(where)) {
    const v = row[key];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
    } else if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as { not?: unknown; notIn?: unknown[] };
      if ("not" in c && c.not === null && (v === null || v === undefined)) return false;
      if (c.notIn && c.notIn.includes(v)) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

const db = vi.hoisted(() => {
  const copy = () => ({ ...store.row });
  return {
    prisma: {
      host: {
        findUnique: vi.fn(async () => copy()),
        findFirst: vi.fn(async () => copy()),
        findMany: vi.fn(async () => [copy()]),
        update: vi.fn(async ({ data }: { data: Row }) => {
          Object.assign(store.row, data);
          return copy();
        }),
        updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
          // matches() is a hoisted function declaration, called lazily.
          if (!matches(store.row, where)) return { count: 0 };
          Object.assign(store.row, data);
          return { count: 1 };
        }),
      },
      hostingPlan: { findFirst: vi.fn(async () => null) },
    },
  };
});
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  isStripeConfigured: () => true,
  getStripe: () => null,
}));
vi.mock("@/lib/features", () => ({ canonicalSiteOrigin: () => "https://ycb.test" }));

import { applyHostingSubscriptionFromStripe } from "./platform-billing";
import { runMarketplaceGraceJob } from "./marketplace-billing";
import { marketplaceCardState } from "./marketplace-billing-plan";

const DAY = 86_400_000;
const T0 = new Date("2026-11-03T18:00:00Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);

function resetBrand() {
  store.row = {
    id: "h1",
    slug: "qa-marketplace-test",
    name: "QA Marketplace Test",
    hostingMode: "PLATFORM",
    sitePresence: "STAYLOCAL",
    subscriptionStatus: "ACTIVE",
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: null,
    stripeSubscriptionStatus: null,
    marketplaceGraceEndsAt: null,
    marketplaceSuspendedAt: null,
    hostingPastDueAt: null,
    hostingDunningReminderSentAt: null,
    planId: "plan_market",
    plan: { monthlyPrice: 12, slug: "marketplace" },
  };
}

const brand = () => store.row as never as Parameters<typeof marketplaceCardState>[0];

function setNow(d: Date) {
  vi.setSystemTime(d);
}

async function stripeSays(subscriptionId: string, stripeStatus: string, extra: Row = {}) {
  await applyHostingSubscriptionFromStripe({
    hostId: "h1",
    customerId: "cus_1",
    subscriptionId,
    stripeStatus,
    ...extra,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  setNow(T0);
  resetBrand();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Marketplace cancel then resubscribe: 14-day grace (T46 follow-up)", () => {
  it("cancel starts 14 days; resubscribe clears it; a second cancel starts a NEW full 14 days", async () => {
    // Day 0: card subscription active. No grace, banner ok.
    await stripeSays("sub_1", "active");
    expect(store.row.marketplaceGraceEndsAt).toBeNull();
    expect(marketplaceCardState(brand(), at(0))).toEqual({ kind: "ok" });

    // Day 0: host cancels (customer.subscription.deleted).
    await stripeSays("sub_1", "canceled");
    expect(store.row.stripeSubscriptionId).toBeNull();
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(14));
    expect(store.row.marketplaceSuspendedAt).toBeNull();
    expect(marketplaceCardState(brand(), at(0))).toMatchObject({ kind: "grace", daysLeft: 14 });

    // Day 3: Stripe replays the same cancel. The window does NOT restart.
    setNow(at(3));
    await stripeSays("sub_1", "canceled");
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(14));
    expect(marketplaceCardState(brand(), at(3))).toMatchObject({ kind: "grace", daysLeft: 11 });

    // Day 5: host resubscribes with a new card subscription. Grace cleared.
    setNow(at(5));
    await stripeSays("sub_2", "active");
    expect(store.row.stripeSubscriptionId).toBe("sub_2");
    expect(store.row.marketplaceGraceEndsAt).toBeNull();
    expect(store.row.marketplaceSuspendedAt).toBeNull();
    expect(marketplaceCardState(brand(), at(5))).toEqual({ kind: "ok" });

    // Day 6: a late "canceled" for the OLD subscription is ignored.
    setNow(at(6));
    await stripeSays("sub_1", "canceled");
    expect(store.row.stripeSubscriptionId).toBe("sub_2");
    expect(store.row.marketplaceGraceEndsAt).toBeNull();

    // The daily grace job leaves a paying brand alone.
    const job = await runMarketplaceGraceJob(at(6));
    expect(job).toMatchObject({ graceStarted: 0, graceCleared: 0, suspended: [], restored: [] });

    // Day 10: host cancels again. A fresh, full 14 days from day 10 (day 24),
    // not the old day-14 date and not "9 days left" from the first window.
    setNow(at(10));
    await stripeSays("sub_2", "canceled");
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(24));
    expect(marketplaceCardState(brand(), at(10))).toMatchObject({ kind: "grace", daysLeft: 14 });
  });

  it("grace runs out: hidden; resubscribe shows listings again; a later cancel gives a fresh visible 14 days", async () => {
    await stripeSays("sub_1", "active");
    await stripeSays("sub_1", "canceled");
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(14));

    // Day 13: still in grace, nothing hidden.
    let job = await runMarketplaceGraceJob(at(13));
    expect(job.suspended).toEqual([]);
    expect(store.row.marketplaceSuspendedAt).toBeNull();

    // Day 14: grace over, no card: listings hidden.
    job = await runMarketplaceGraceJob(at(14));
    expect(job.suspended).toEqual(["qa-marketplace-test"]);
    expect(store.row.marketplaceSuspendedAt).toEqual(at(14));
    expect(marketplaceCardState(brand(), at(14))).toMatchObject({ kind: "suspended" });

    // Day 20: resubscribe. Hide and grace date cleared at once (webhook).
    setNow(at(20));
    await stripeSays("sub_2", "active");
    expect(store.row.marketplaceSuspendedAt).toBeNull();
    expect(store.row.marketplaceGraceEndsAt).toBeNull();
    expect(marketplaceCardState(brand(), at(20))).toEqual({ kind: "ok" });

    // Day 21: cancel again. Listings stay visible for a new 14 days (day 35).
    setNow(at(21));
    await stripeSays("sub_2", "canceled");
    expect(store.row.marketplaceSuspendedAt).toBeNull();
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(35));
    job = await runMarketplaceGraceJob(at(34));
    expect(job.suspended).toEqual([]);
    job = await runMarketplaceGraceJob(at(35));
    expect(job.suspended).toEqual(["qa-marketplace-test"]);
  });

  it("cancel at period end: no grace while the subscription is still active", async () => {
    await stripeSays("sub_1", "active");
    setNow(at(2));
    await stripeSays("sub_1", "active", { cancelAtPeriodEnd: true });
    expect(store.row.marketplaceGraceEndsAt).toBeNull();
    expect(marketplaceCardState(brand(), at(2))).toEqual({ kind: "ok" });

    // Period ends on day 30: Stripe ends it, grace starts then (day 44).
    setNow(at(30));
    await stripeSays("sub_1", "canceled");
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(44));
  });

  it("past_due between cancel and resubscribe does not move the grace date", async () => {
    await stripeSays("sub_1", "active");
    await stripeSays("sub_1", "canceled");
    setNow(at(4));
    // A new subscription whose first payment failed: past_due keeps the dates.
    await stripeSays("sub_2", "past_due");
    expect(store.row.marketplaceGraceEndsAt).toEqual(at(14));
    // Paid on day 6: grace cleared.
    setNow(at(6));
    await stripeSays("sub_2", "active");
    expect(store.row.marketplaceGraceEndsAt).toBeNull();
  });
});
