/**
 * Features that ship only on the hosted Yall Come Back platform / marketplace —
 * NOT part of the MIT open-source self-host product.
 *
 * Open-source builds should leave PLATFORM_PRODUCT_MODE unset/false so these
 * routes stay dark and cron jobs no-op.
 */

import type { PricingAddonStatus } from "@prisma/client";

/** Monthly fee for market pricing intelligence — never bundled into core hosting. */
export const PRICING_INTELLIGENCE_ADDON_USD = 35;

export const PRICING_INTELLIGENCE_ADDON_LABEL =
  "Market pricing intelligence";

export const PRICING_INTELLIGENCE_ADDON_BLURB =
  "Monthly AI market research and rate suggestions for your stays (capacity-matched comps). Optional add-on — not included in website hosting.";

/**
 * Hosted YCB marketplace product (not a vanilla open-source self-host).
 * Set PLATFORM_PRODUCT_MODE=true on Railway / main product deploys.
 * Set YCB_OPEN_SOURCE_BUILD=true on MIT self-host builds to force off.
 */
export function isPlatformProductMode(): boolean {
  if (process.env.YCB_OPEN_SOURCE_BUILD?.trim().toLowerCase() === "true") {
    return false;
  }
  const raw = process.env.PLATFORM_PRODUCT_MODE?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Feature exists on this deploy (platform product). Does not mean a given host
 * has paid for the $35/mo add-on — use hostHasPricingIntelligenceAddon for that.
 */
export function isPricingIntelligenceEnabled(): boolean {
  if (process.env.YCB_OPEN_SOURCE_BUILD?.trim().toLowerCase() === "true") {
    return false;
  }
  const raw = process.env.PRICING_INTELLIGENCE_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return isPlatformProductMode();
}

/** Host has an active $35/mo pricing intelligence subscription. */
export function hostHasPricingIntelligenceAddon(host: {
  pricingIntelligenceAddonStatus: PricingAddonStatus | string;
}): boolean {
  return host.pricingIntelligenceAddonStatus === "ACTIVE";
}

export function pricingAddonStatusLabel(
  status: PricingAddonStatus | string,
): string {
  switch (status) {
    case "NONE":
      return "Not subscribed";
    case "REQUESTED":
      return "Requested — awaiting activation";
    case "ACTIVE":
      return "Active (+$35/mo)";
    case "PAST_DUE":
      return "Past due";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(status);
  }
}

/** Optional xAI / Grok key for richer competitor research narratives. */
export function pricingIntelligenceLlmConfigured(): boolean {
  return Boolean(
    process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  );
}

export const PLATFORM_ONLY_FEATURE_LABELS = [
  "Market pricing intelligence add-on ($35/mo — not in hosting fee)",
  "OTA peer comps (Airbnb / VRBO / Booking-style capacity matching)",
  "Human-approved price apply (suggestion-only by default)",
] as const;
