/**
 * T45 — Marketplace card billing, pure helpers (no DB / Stripe imports) so
 * pages, the scheduler, webhooks and tests share one set of rules.
 *
 * Billing shape: ONE Stripe subscription per Marketplace brand with
 *   - one item per published listing ($12/mo each, named after the listing)
 *   - one "Card processing" item (2.9% + $0.30 on the listing total, the
 *     same formula Branded uses)
 * Listing changes edit the items with proration_behavior "none", so the
 * change shows on the NEXT bill and nothing is charged mid-month.
 */
import { processingFeeToNetCents } from "./card-processing";
import { MARKETPLACE_LISTING_USD } from "./hosting-prices";

/** Days an existing Marketplace brand has to add a card (from first view). */
export const MARKETPLACE_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Subscription + session metadata value for the Marketplace product. */
export const MARKETPLACE_PRODUCT = "marketplace";

/**
 * Stripe Product ids are created in code with a fixed id, so every sync
 * finds the same Product (no Dashboard setup, no duplicates).
 */
export const LISTING_PRODUCT_PREFIX = "ycb_mkt_listing_";
export const MINIMUM_LISTING_PRODUCT_ID = `${LISTING_PRODUCT_PREFIX}minimum`;
export const MARKETPLACE_FEE_PRODUCT_ID = "ycb_mkt_card_processing";
export const MINIMUM_LISTING_NAME =
  "Marketplace listing (1 listing minimum until you publish)";
/**
 * Stripe allows 20 items on one subscription. Card processing takes one, so
 * the first 18 listings get their own named item and the rest share one
 * "each additional listing" item (quantity = how many).
 */
export const MAX_SUBSCRIPTION_ITEMS = 20;
export const MAX_NAMED_LISTING_ITEMS = MAX_SUBSCRIPTION_ITEMS - 2;
export const ADDITIONAL_LISTINGS_PRODUCT_ID = `${LISTING_PRODUCT_PREFIX}additional`;
export const ADDITIONAL_LISTINGS_NAME = "Marketplace listing (each additional listing)";

export function marketplaceListingProductId(propertyId: string): string {
  return `${LISTING_PRODUCT_PREFIX}${propertyId}`;
}

/** Stripe product names are limited; keep the listing name readable. */
export function marketplaceListingName(title: string | null | undefined): string {
  const t = (title || "").trim() || "Untitled listing";
  const name = `Marketplace listing: ${t}`;
  return name.length > 250 ? `${name.slice(0, 247)}...` : name;
}

/** Monthly $ per listing in cents. A $0 / missing plan uses the published price. */
export function marketplaceUnitCents(planMonthlyUsd: number | null | undefined): number {
  const usd =
    planMonthlyUsd && planMonthlyUsd > 0 ? planMonthlyUsd : MARKETPLACE_LISTING_USD;
  return Math.round(usd * 100);
}

export type BillableListing = {
  id: string;
  title: string | null;
  published: boolean;
  archivedAt: Date | null;
};

/** A published, not archived listing is billed. */
export function isBillableListing(p: Pick<BillableListing, "published" | "archivedAt">): boolean {
  return p.published && !p.archivedAt;
}

export type DesiredLine = {
  productId: string;
  name: string;
  unitCents: number;
  quantity: number;
  propertyId: string | null;
};

/**
 * The listing lines the subscription should have. No published listing →
 * one "1 listing minimum" line (same minimum the estimate shows).
 */
export function desiredMarketplaceLines(
  listings: BillableListing[],
  unitCents: number,
): DesiredLine[] {
  const billable = listings
    .filter(isBillableListing)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (billable.length === 0) {
    return [
      {
        productId: MINIMUM_LISTING_PRODUCT_ID,
        name: MINIMUM_LISTING_NAME,
        unitCents,
        quantity: 1,
        propertyId: null,
      },
    ];
  }
  const fitsNamed = billable.length <= MAX_NAMED_LISTING_ITEMS + 1;
  const named = fitsNamed ? billable : billable.slice(0, MAX_NAMED_LISTING_ITEMS);
  const lines: DesiredLine[] = named.map((p) => ({
    productId: marketplaceListingProductId(p.id),
    name: marketplaceListingName(p.title),
    unitCents,
    quantity: 1,
    propertyId: p.id,
  }));
  const extra = billable.length - named.length;
  if (extra > 0) {
    lines.push({
      productId: ADDITIONAL_LISTINGS_PRODUCT_ID,
      name: ADDITIONAL_LISTINGS_NAME,
      unitCents,
      quantity: extra,
      propertyId: null,
    });
  }
  return lines;
}

/** Card processing on the listing total (2.9% + $0.30 on the whole bill). */
export function marketplaceFeeCents(
  lines: Pick<DesiredLine, "unitCents" | "quantity">[],
): number {
  const net = lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
  return processingFeeToNetCents(net);
}

export type CurrentItem = {
  id: string;
  productId: string;
  productName: string | null;
  unitCents: number | null;
  quantity: number;
};

export type ItemSyncPlan = {
  add: DesiredLine[];
  remove: string[];
  /** Listing items whose price changed (plan price change). */
  reprice: { itemId: string; line: DesiredLine }[];
  /** Products to rename (listing title changed). */
  rename: { productId: string; name: string }[];
  fee:
    | { action: "keep"; itemId: string; cents: number }
    | { action: "update"; itemId: string; cents: number }
    | { action: "add"; cents: number }
    | { action: "remove"; itemId: string; cents: 0 }
    | { action: "none"; cents: 0 };
  /** True when nothing changes on Stripe. */
  noop: boolean;
};

/**
 * Diff the subscription items Stripe has against what the brand should pay.
 * Items not made by this code (unknown products) are left alone.
 */
export function planMarketplaceItemSync(
  current: CurrentItem[],
  desired: DesiredLine[],
): ItemSyncPlan {
  const feeCents = marketplaceFeeCents(desired);
  const listingItems = current.filter((i) =>
    i.productId.startsWith(LISTING_PRODUCT_PREFIX),
  );
  const feeItems = current.filter((i) => i.productId === MARKETPLACE_FEE_PRODUCT_ID);

  const byProduct = new Map<string, CurrentItem>();
  const remove: string[] = [];
  for (const item of listingItems) {
    if (byProduct.has(item.productId)) remove.push(item.id);
    else byProduct.set(item.productId, item);
  }
  const wanted = new Set(desired.map((d) => d.productId));
  for (const [productId, item] of byProduct) {
    if (!wanted.has(productId)) remove.push(item.id);
  }

  const add: DesiredLine[] = [];
  const reprice: { itemId: string; line: DesiredLine }[] = [];
  const rename: { productId: string; name: string }[] = [];
  for (const line of desired) {
    const item = byProduct.get(line.productId);
    if (!item) {
      add.push(line);
      continue;
    }
    if (item.unitCents !== line.unitCents || item.quantity !== line.quantity) {
      reprice.push({ itemId: item.id, line });
    }
    if (item.productName != null && item.productName !== line.name) {
      rename.push({ productId: line.productId, name: line.name });
    }
  }

  const [feeItem, ...extraFees] = feeItems;
  for (const extra of extraFees) remove.push(extra.id);
  let fee: ItemSyncPlan["fee"];
  if (feeCents <= 0) {
    fee = feeItem
      ? { action: "remove", itemId: feeItem.id, cents: 0 }
      : { action: "none", cents: 0 };
    if (feeItem) remove.push(feeItem.id);
  } else if (!feeItem) {
    fee = { action: "add", cents: feeCents };
  } else if (feeItem.unitCents !== feeCents || feeItem.quantity !== 1) {
    fee = { action: "update", itemId: feeItem.id, cents: feeCents };
  } else {
    fee = { action: "keep", itemId: feeItem.id, cents: feeCents };
  }

  const noop =
    add.length === 0 &&
    remove.length === 0 &&
    reprice.length === 0 &&
    rename.length === 0 &&
    (fee.action === "keep" || fee.action === "none");
  return { add, remove, reprice, rename, fee, noop };
}

/* ------------------------------------------------------------------ */
/* Grace period + suspension                                           */
/* ------------------------------------------------------------------ */

export type MarketplaceGraceHost = {
  hostingMode: "SELF" | "PLATFORM";
  sitePresence: "STAYLOCAL" | "CUSTOM" | "BOTH";
  stripeSubscriptionId: string | null;
  stripeSubscriptionStatus: string | null;
  marketplaceGraceEndsAt: Date | null;
  marketplaceSuspendedAt: Date | null;
  plan?: { monthlyPrice: number } | null;
};

/** Stripe statuses that mean a card subscription is in place. */
const CARD_ON_SUBSCRIPTION = new Set(["active", "trialing", "past_due", "unpaid"]);

export function hasLiveCardSubscription(
  host: Pick<MarketplaceGraceHost, "stripeSubscriptionId" | "stripeSubscriptionStatus">,
): boolean {
  if (!host.stripeSubscriptionId) return false;
  return CARD_ON_SUBSCRIPTION.has((host.stripeSubscriptionStatus || "").toLowerCase());
}

/**
 * A paid Marketplace brand on the hosted platform with no card
 * subscription. Complimentary ($0) brands never need a card.
 */
export function marketplaceNeedsCard(host: MarketplaceGraceHost): boolean {
  if (host.hostingMode !== "PLATFORM") return false;
  if (host.sitePresence !== "STAYLOCAL") return false;
  if (host.plan && host.plan.monthlyPrice <= 0) return false;
  return !hasLiveCardSubscription(host);
}

export function marketplaceGraceEndFrom(now: Date): Date {
  return new Date(now.getTime() + MARKETPLACE_GRACE_DAYS * DAY_MS);
}

export type MarketplaceCardState =
  | { kind: "ok" }
  | { kind: "grace"; endsAt: Date; daysLeft: number }
  | { kind: "suspended"; since: Date }
  /** Needs a card; grace not stamped yet (first view stamps it). */
  | { kind: "grace_unset" };

export function marketplaceCardState(
  host: MarketplaceGraceHost,
  now: Date = new Date(),
): MarketplaceCardState {
  if (!marketplaceNeedsCard(host)) return { kind: "ok" };
  if (host.marketplaceSuspendedAt) {
    return { kind: "suspended", since: host.marketplaceSuspendedAt };
  }
  if (!host.marketplaceGraceEndsAt) return { kind: "grace_unset" };
  const ms = host.marketplaceGraceEndsAt.getTime() - now.getTime();
  return {
    kind: "grace",
    endsAt: host.marketplaceGraceEndsAt,
    daysLeft: Math.max(0, Math.ceil(ms / DAY_MS)),
  };
}

/** Grace over and still no card: the scheduler hides the listings. */
export function shouldSuspendMarketplace(
  host: MarketplaceGraceHost,
  now: Date = new Date(),
): boolean {
  if (!marketplaceNeedsCard(host)) return false;
  if (host.marketplaceSuspendedAt) return false;
  if (!host.marketplaceGraceEndsAt) return false;
  return host.marketplaceGraceEndsAt.getTime() <= now.getTime();
}

/** Card subscription in place again: show the listings again. */
export function shouldRestoreMarketplace(host: MarketplaceGraceHost): boolean {
  return Boolean(host.marketplaceSuspendedAt) && !marketplaceNeedsCard(host);
}
