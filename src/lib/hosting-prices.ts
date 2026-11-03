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
  `$${BRANDED_WEBSITE_USD} / month for the whole website — any number of listings. Brand site on your domain; marketplace listing included. Not a booking commission.`;

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
 * Branded website price with the card processing line:
 * "$25/mo + $1.06/mo card processing". T43: this one format everywhere.
 */
export function brandedPriceLabel(netUsd: number = BRANDED_WEBSITE_USD): string {
  const base = `${formatUsd(netUsd)}/mo`;
  const note = cardProcessingNote(netUsd);
  return note ? `${base} + ${note}` : base;
}
