/**
 * Published hosted prices. Keep website, help, agent briefs, and HostingPlan
 * seed/upsert in sync with these numbers.
 *
 * Open-source MIT software is the only free product ($0 platform fee when you
 * run it yourself). Marketplace listing on yallcomeback.app and branded
 * websites are paid.
 */
import { processingFeeToNetCents } from "./card-processing";

export const MARKETPLACE_LISTING_USD = 12;
export const BRANDED_WEBSITE_USD = 25;

export const MARKETPLACE_PLAN_DESCRIPTION =
  `$${MARKETPLACE_LISTING_USD} per published listing / month. List on Find a Place. No custom brand website. Not a booking commission.`;

export const BRANDED_PLAN_DESCRIPTION =
  `$${BRANDED_WEBSITE_USD}/mo for the whole website — any number of listings. Brand site on your domain; marketplace listing included. Not a booking commission.`;

/**
 * Card processing the hosting card checkout adds on top of a plan price —
 * the same math as the checkout's "Card processing" line
 * (`processingFeeToNetCents` on the plan amount). Pure: safe in client code.
 */
export function cardProcessingUsd(netUsd: number = BRANDED_WEBSITE_USD): number {
  return processingFeeToNetCents(Math.round(netUsd * 100)) / 100;
}

/** "$25" for whole dollars, "$1.06" otherwise. */
export function formatUsd(usd: number): string {
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

/** "$1.06/mo card processing" — the add-on for a branded plan price. */
export function cardProcessingNote(netUsd: number = BRANDED_WEBSITE_USD): string {
  const fee = cardProcessingUsd(netUsd);
  if (fee <= 0) return "";
  return `${formatUsd(fee)}/mo card processing`;
}

/**
 * Marketplace price: "$12/mo per listing" (T44). Falls back to the published
 * price when a plan amount is missing or $0, so copy never shows a stale number.
 */
export function marketplacePriceLabel(
  unitUsd: number | null | undefined = MARKETPLACE_LISTING_USD,
): string {
  const usd = unitUsd && unitUsd > 0 ? unitUsd : MARKETPLACE_LISTING_USD;
  return `${formatUsd(usd)}/mo per listing`;
}

/**
 * Branded website price with the card processing line:
 * "$25/mo + $1.06/mo card processing". T43: this one format everywhere.
 */
export function brandedPriceLabel(netUsd: number = BRANDED_WEBSITE_USD): string {
  const base = `${formatUsd(netUsd)}/mo`;
  const note = cardProcessingNote(netUsd);
  return note ? `${base} + ${note}` : base;
}

/**
 * A leading price in a stored plan description, e.g. "$25 / month ",
 * "$$25 / month ", "$25/mo ", "$25 per month — ". The stored text can be
 * old (DB rows are never rewritten), so price copy never comes from it.
 */
const LEADING_PRICE =
  /^\s*\$+\s*\d+(?:\.\d+)?(?:\s*USD)?\s*(?:\/\s*month|\/\s*mo|per\s+month|a\s+month)\b(?:\s*\+\s*\$?\d+(?:\.\d+)?\s*(?:\/\s*month|\/\s*mo)\s*card processing)?\s*[—–-]?\s*/i;

/** Stored description without a leading price (T43). */
export function stripLeadingPrice(description: string | null | undefined): string {
  return (description || "").replace(LEADING_PRICE, "").trim();
}

/**
 * T43: plan description safe to show. Flat (Branded) plans get the price
 * from the plan amount and the shared short formatter, then the stored
 * non-price text. Other plans keep the stored text.
 */
export function planPublicDescription(plan: {
  pricingModel: string;
  monthlyPrice: number;
  description: string | null;
}): string | null {
  if (plan.pricingModel !== "FLAT" || !(plan.monthlyPrice > 0)) {
    return plan.description;
  }
  const rest = stripLeadingPrice(plan.description);
  const price = brandedPriceLabel(plan.monthlyPrice);
  return rest ? `${price} ${rest}` : price;
}
