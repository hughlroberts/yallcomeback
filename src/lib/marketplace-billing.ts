/**
 * T45 — Marketplace card billing (Stripe + DB).
 *
 * - Checkout: one subscription, one item per published listing ($12/mo,
 *   named after the listing) plus one "Card processing" item.
 * - Sync: listing publish / unpause / pause / archive / delete / rename edit
 *   the items with proration_behavior "none" → the NEXT bill changes, nothing
 *   is charged mid-month. Runs on listing change, on the invoice.upcoming
 *   webhook (before the renewal invoice), and once a day from the in-process
 *   scheduler as a safety net.
 * - Grace: a Marketplace brand with no card subscription gets 14 days (from
 *   first view or first scheduler run after deploy). Then its listings are
 *   hidden from Find a Place (Host.marketplaceSuspendedAt). Listing rows are
 *   not changed. Paying clears it and the listings show again.
 *
 * Prices are created in code (price_data). Products use fixed ids so every
 * sync finds the same one. No Dashboard setup.
 */
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { canonicalSiteOrigin } from "@/lib/features";
import { hostProductPath } from "@/lib/hosting";
import { SUBSCRIPTION_PATH } from "@/lib/branded-upgrade";
import { getStripe, isStripeConfigured, requireStripeClient } from "@/lib/stripe";
import { CARD_PROCESSING_LINE } from "@/lib/card-processing";
import {
  HostingBillingError,
  createPlatformBillingPortalSession,
  ensurePlatformCustomer,
  type PlatformHost,
} from "@/lib/platform-billing";
import {
  MARKETPLACE_FEE_PRODUCT_ID,
  MARKETPLACE_PRODUCT,
  desiredMarketplaceLines,
  hasLiveCardSubscription,
  marketplaceFeeCents,
  marketplaceGraceEndFrom,
  marketplaceNeedsCard,
  marketplaceUnitCents,
  planMarketplaceItemSync,
  shouldRestoreMarketplace,
  shouldSuspendMarketplace,
  type CurrentItem,
  type DesiredLine,
  type MarketplaceGraceHost,
} from "@/lib/marketplace-billing-plan";

export const MARKETPLACE_METADATA = {
  kind: "hosting_subscription",
  product: MARKETPLACE_PRODUCT,
} as const;

type MarketplaceBillingHost = PlatformHost & {
  hostingMode: "SELF" | "PLATFORM";
  sitePresence: "STAYLOCAL" | "CUSTOM" | "BOTH";
  subscriptionStatus: string;
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  plan?: { monthlyPrice: number } | null;
};

/** $ per listing for this brand: its plan, else the paid Marketplace plan. */
export async function marketplaceUnitCentsForHost(host: {
  plan?: { monthlyPrice: number } | null;
}): Promise<number> {
  if (host.plan && host.plan.monthlyPrice > 0) {
    return marketplaceUnitCents(host.plan.monthlyPrice);
  }
  const paid = await prisma.hostingPlan.findFirst({
    where: { slug: "marketplace", isActive: true, monthlyPrice: { gt: 0 } },
    select: { monthlyPrice: true },
  });
  return marketplaceUnitCents(paid?.monthlyPrice);
}

export async function marketplaceLinesForHost(host: {
  id: string;
  plan?: { monthlyPrice: number } | null;
}): Promise<DesiredLine[]> {
  const [listings, unitCents] = await Promise.all([
    prisma.property.findMany({
      where: { hostId: host.id },
      select: { id: true, title: true, published: true, archivedAt: true },
    }),
    marketplaceUnitCentsForHost(host),
  ]);
  return desiredMarketplaceLines(listings, unitCents);
}

function isMissing(err: unknown): boolean {
  const e = err as { code?: string; statusCode?: number; message?: string };
  return (
    e?.code === "resource_missing" ||
    e?.statusCode === 404 ||
    /no such product/i.test(e?.message || "")
  );
}

/** Find or create a Product with a fixed id; keep its name current. */
export async function ensureStripeProduct(
  stripe: Stripe,
  id: string,
  name: string,
  metadata: Record<string, string> = {},
): Promise<string> {
  try {
    const p = await stripe.products.retrieve(id);
    if (p.name !== name || !p.active) {
      await stripe.products.update(id, { name, active: true });
    }
    return id;
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
  try {
    await stripe.products.create({ id, name, metadata });
  } catch (err) {
    // Two syncs raced: the other one made it. Fine.
    const code = (err as { code?: string })?.code;
    if (code !== "resource_already_exists") throw err;
  }
  return id;
}

async function ensureLineProducts(stripe: Stripe, lines: DesiredLine[]) {
  for (const line of lines) {
    await ensureStripeProduct(stripe, line.productId, line.name, {
      kind: "marketplace_listing",
      ...(line.propertyId ? { propertyId: line.propertyId } : {}),
    });
  }
}

function ensureFeeProduct(stripe: Stripe) {
  return ensureStripeProduct(stripe, MARKETPLACE_FEE_PRODUCT_ID, CARD_PROCESSING_LINE, {
    kind: "card_processing",
  });
}

/**
 * Card checkout for a Marketplace brand: one item per published listing +
 * card processing. The plan / visibility change only after Stripe confirms.
 */
export async function createMarketplaceSubscriptionCheckout(
  host: MarketplaceBillingHost,
) {
  const stripe = requireStripeClient();
  const customerId = await ensurePlatformCustomer(host);
  const lines = await marketplaceLinesForHost(host);
  const feeCents = marketplaceFeeCents(lines);
  await ensureLineProducts(stripe, lines);
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map(
    (line) => ({
      quantity: line.quantity,
      price_data: {
        currency: "usd",
        unit_amount: line.unitCents,
        recurring: { interval: "month" },
        product: line.productId,
      },
    }),
  );
  if (feeCents > 0) {
    await ensureFeeProduct(stripe);
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: feeCents,
        recurring: { interval: "month" },
        product: MARKETPLACE_FEE_PRODUCT_ID,
      },
    });
  }
  const metadata: Record<string, string> = {
    ...MARKETPLACE_METADATA,
    hostId: host.id,
  };
  const origin = canonicalSiteOrigin();
  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    payment_method_collection: "always",
    billing_address_collection: "auto",
    line_items,
    success_url: `${origin}${SUBSCRIPTION_PATH}?subscribed=1&plan=marketplace&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${SUBSCRIPTION_PATH}?canceled=1&plan=marketplace`,
    metadata,
    subscription_data: { metadata },
  });
}

/**
 * "Add card" for a Marketplace brand: fresh checkout, or the billing
 * portal when a card subscription is already in place.
 */
export async function marketplaceSubscriptionUrl(
  host: MarketplaceBillingHost,
): Promise<string> {
  if (hostProductPath(host) !== "marketplace") {
    throw new HostingBillingError("not_marketplace");
  }
  if (hasLiveCardSubscription(host) && host.stripeCustomerId) {
    const portal = await createPlatformBillingPortalSession(host.stripeCustomerId);
    if (!portal.url) throw new HostingBillingError("failed", "no portal url");
    return portal.url;
  }
  const session = await createMarketplaceSubscriptionCheckout(host);
  if (!session.url) throw new HostingBillingError("failed", "no checkout url");
  return session.url;
}

/* ------------------------------------------------------------------ */
/* Item sync                                                           */
/* ------------------------------------------------------------------ */

export type MarketplaceSyncResult =
  | { status: "skipped"; reason: string }
  | { status: "noop" }
  | {
      status: "synced";
      added: number;
      removed: number;
      repriced: number;
      renamed: number;
      feeCents: number;
    };

function productIdOf(price: Stripe.Price | null | undefined): string {
  const p = price?.product;
  if (!p) return "";
  return typeof p === "string" ? p : p.id;
}

function productNameOf(price: Stripe.Price | null | undefined): string | null {
  const p = price?.product;
  if (!p || typeof p === "string") return null;
  return "name" in p ? (p.name ?? null) : null;
}

export function currentItemsFromSubscription(sub: Stripe.Subscription): CurrentItem[] {
  return (sub.items?.data || []).map((item) => ({
    id: item.id,
    productId: productIdOf(item.price),
    productName: productNameOf(item.price),
    unitCents: item.price?.unit_amount ?? null,
    quantity: item.quantity ?? 1,
  }));
}

const syncLocks = new Map<string, Promise<MarketplaceSyncResult>>();

/** Serialize syncs per brand inside this process. */
export function syncMarketplaceSubscriptionItems(
  hostId: string,
): Promise<MarketplaceSyncResult> {
  const prev = syncLocks.get(hostId) ?? Promise.resolve(null);
  const next = prev
    .catch(() => null)
    .then(() => runMarketplaceItemSync(hostId));
  syncLocks.set(hostId, next);
  void next.finally(() => {
    if (syncLocks.get(hostId) === next) syncLocks.delete(hostId);
  }).catch(() => null);
  return next;
}

async function runMarketplaceItemSync(hostId: string): Promise<MarketplaceSyncResult> {
  const stripe = getStripe();
  if (!stripe) return { status: "skipped", reason: "stripe_off" };
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: { plan: { select: { monthlyPrice: true } } },
  });
  if (!host) return { status: "skipped", reason: "no_host" };
  if (hostProductPath(host) !== "marketplace") {
    return { status: "skipped", reason: "not_marketplace" };
  }
  if (!host.stripeSubscriptionId) {
    return { status: "skipped", reason: "no_subscription" };
  }
  const sub = await stripe.subscriptions.retrieve(host.stripeSubscriptionId, {
    expand: ["items.data.price.product"],
  });
  if (sub.status === "canceled" || sub.status === "incomplete_expired") {
    return { status: "skipped", reason: "subscription_ended" };
  }
  // Only ever edit the Marketplace subscription this code made.
  if (sub.metadata?.product !== MARKETPLACE_PRODUCT) {
    return { status: "skipped", reason: "not_marketplace_subscription" };
  }
  if (sub.items?.has_more) {
    // The embedded list can be cut short; read every item.
    const all = await stripe.subscriptionItems.list({
      subscription: sub.id,
      limit: 100,
      expand: ["data.price.product"],
    });
    sub.items = { ...sub.items, data: all.data, has_more: false };
  }
  const desired = await marketplaceLinesForHost(host);
  const plan = planMarketplaceItemSync(currentItemsFromSubscription(sub), desired);
  if (plan.noop) return { status: "noop" };

  const currency = (sub.currency || "usd").toLowerCase();
  const none = "none" as const;
  // Stripe allows 20 items and needs at least 1. Remove first (stays under
  // 20) unless that would leave no item; then add first.
  const removeItems = async () => {
    for (const itemId of plan.remove) {
      await stripe.subscriptionItems.del(itemId, { proration_behavior: none });
    }
  };
  const currentCount = sub.items?.data?.length ?? 0;
  const removeFirst = currentCount - plan.remove.length >= 1;
  if (removeFirst) await removeItems();
  await ensureLineProducts(stripe, [...plan.add, ...plan.reprice.map((r) => r.line)]);
  for (const line of plan.add) {
    await stripe.subscriptionItems.create({
      subscription: sub.id,
      quantity: line.quantity,
      price_data: {
        currency,
        unit_amount: line.unitCents,
        recurring: { interval: "month" },
        product: line.productId,
      },
      proration_behavior: none,
      metadata: line.propertyId ? { propertyId: line.propertyId } : {},
    });
  }
  for (const { itemId, line } of plan.reprice) {
    await stripe.subscriptionItems.update(itemId, {
      quantity: line.quantity,
      price_data: {
        currency,
        unit_amount: line.unitCents,
        recurring: { interval: "month" },
        product: line.productId,
      },
      proration_behavior: none,
    });
  }
  if (plan.fee.action === "add" || plan.fee.action === "update") {
    await ensureFeeProduct(stripe);
    const price_data = {
      currency,
      unit_amount: plan.fee.cents,
      recurring: { interval: "month" as const },
      product: MARKETPLACE_FEE_PRODUCT_ID,
    };
    if (plan.fee.action === "add") {
      await stripe.subscriptionItems.create({
        subscription: sub.id,
        quantity: 1,
        price_data,
        proration_behavior: none,
      });
    } else {
      await stripe.subscriptionItems.update(plan.fee.itemId, {
        quantity: 1,
        price_data,
        proration_behavior: none,
      });
    }
  }
  for (const r of plan.rename) {
    // ensureLineProducts above already renamed products it touched.
    await stripe.products.update(r.productId, { name: r.name });
  }
  if (!removeFirst) await removeItems();
  return {
    status: "synced",
    added: plan.add.length,
    removed: plan.remove.length,
    repriced: plan.reprice.length,
    renamed: plan.rename.length,
    feeCents: plan.fee.cents,
  };
}

/**
 * Fire-and-forget sync after a listing change. Never throws, never blocks
 * the host's save. The daily run and invoice.upcoming catch anything missed.
 */
export function queueMarketplaceBillingSync(hostId: string | null | undefined): void {
  if (!hostId || !isStripeConfigured()) return;
  void syncMarketplaceSubscriptionItems(hostId).catch((err) => {
    console.error("[marketplace-billing] item sync failed", hostId, err);
  });
}

/* ------------------------------------------------------------------ */
/* Grace + suspension                                                  */
/* ------------------------------------------------------------------ */

const GRACE_SELECT = {
  id: true,
  slug: true,
  hostingMode: true,
  sitePresence: true,
  stripeSubscriptionId: true,
  stripeSubscriptionStatus: true,
  marketplaceGraceEndsAt: true,
  marketplaceSuspendedAt: true,
  plan: { select: { monthlyPrice: true } },
} as const;

/**
 * Lazily start the 14-day grace for a Marketplace brand with no card
 * (first view of Subscription / Admin). Returns the grace end, or null when
 * the brand does not need a card. Only stamps an empty field.
 */
export async function ensureMarketplaceGrace(
  host: MarketplaceGraceHost & { id: string },
  now: Date = new Date(),
): Promise<Date | null> {
  if (!isStripeConfigured()) return null;
  if (!marketplaceNeedsCard(host)) return null;
  if (host.marketplaceGraceEndsAt) return host.marketplaceGraceEndsAt;
  const endsAt = marketplaceGraceEndFrom(now);
  await prisma.host.updateMany({
    where: { id: host.id, marketplaceGraceEndsAt: null },
    data: { marketplaceGraceEndsAt: endsAt },
  });
  const fresh = await prisma.host.findUnique({
    where: { id: host.id },
    select: { marketplaceGraceEndsAt: true },
  });
  return fresh?.marketplaceGraceEndsAt ?? endsAt;
}

/** Show the listings again (payment / plan change). Idempotent. */
export async function restoreMarketplaceListings(hostId: string): Promise<boolean> {
  const res = await prisma.host.updateMany({
    where: { id: hostId, marketplaceSuspendedAt: { not: null } },
    data: { marketplaceSuspendedAt: null },
  });
  return res.count > 0;
}

export type MarketplaceGraceResult = {
  skipped: boolean;
  graceStarted: number;
  suspended: string[];
  restored: string[];
  errors: string[];
};

/**
 * In-process scheduler job (every run, DB only — no Stripe call):
 * stamp grace for brands that need a card, hide listings when the grace
 * ended with no card, show them again once a card subscription is in place.
 */
export async function runMarketplaceGraceJob(
  now: Date = new Date(),
): Promise<MarketplaceGraceResult> {
  const out: MarketplaceGraceResult = {
    skipped: false,
    graceStarted: 0,
    suspended: [],
    restored: [],
    errors: [],
  };
  if (!isStripeConfigured()) return { ...out, skipped: true };
  const hosts = await prisma.host.findMany({
    where: { hostingMode: "PLATFORM" },
    select: GRACE_SELECT,
  });
  for (const host of hosts) {
    try {
      if (shouldRestoreMarketplace(host)) {
        if (await restoreMarketplaceListings(host.id)) out.restored.push(host.slug);
        continue;
      }
      if (!marketplaceNeedsCard(host)) continue;
      if (!host.marketplaceGraceEndsAt) {
        await ensureMarketplaceGrace(host, now);
        out.graceStarted += 1;
        continue;
      }
      if (shouldSuspendMarketplace(host, now)) {
        const res = await prisma.host.updateMany({
          where: { id: host.id, marketplaceSuspendedAt: null },
          data: { marketplaceSuspendedAt: now },
        });
        if (res.count > 0) out.suspended.push(host.slug);
      }
    } catch (e) {
      out.errors.push(`${host.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}

const DAILY_MARKETPLACE_SYNC_JOB = "marketplace-billing-sync";

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Once per UTC day: re-sync every live Marketplace subscription's items. */
export async function maybeRunDailyMarketplaceSync(
  now: Date = new Date(),
): Promise<{ skipped: boolean; synced: number; errors: string[] }> {
  if (!isStripeConfigured()) return { skipped: true, synced: 0, errors: [] };
  const existing = await prisma.cronRun.findUnique({
    where: { name: DAILY_MARKETPLACE_SYNC_JOB },
  });
  if (
    existing?.lastOk &&
    existing.lastFinishedAt &&
    utcDay(existing.lastFinishedAt) === utcDay(now)
  ) {
    return { skipped: true, synced: 0, errors: [] };
  }
  await prisma.cronRun.upsert({
    where: { name: DAILY_MARKETPLACE_SYNC_JOB },
    create: { name: DAILY_MARKETPLACE_SYNC_JOB, lastStartedAt: now, lastOk: false },
    update: { lastStartedAt: now, lastOk: false },
  });
  const hosts = await prisma.host.findMany({
    where: {
      hostingMode: "PLATFORM",
      sitePresence: "STAYLOCAL",
      stripeSubscriptionId: { not: null },
    },
    select: { id: true, slug: true },
  });
  let synced = 0;
  const errors: string[] = [];
  for (const h of hosts) {
    try {
      const r = await syncMarketplaceSubscriptionItems(h.id);
      if (r.status === "synced") synced += 1;
    } catch (e) {
      errors.push(`${h.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await prisma.cronRun.update({
    where: { name: DAILY_MARKETPLACE_SYNC_JOB },
    data: {
      lastFinishedAt: new Date(),
      lastOk: errors.length === 0,
      lastSummary: `synced ${synced}/${hosts.length}${errors.length ? `; ${errors.length} errors` : ""}`.slice(0, 500),
    },
  });
  return { skipped: false, synced, errors };
}
