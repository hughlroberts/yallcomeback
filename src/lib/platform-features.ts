/**
 * Features that ship only on the hosted Yall Come Back platform / marketplace —
 * NOT part of the MIT open-source self-host product.
 *
 * Open-source builds should leave PLATFORM_PRODUCT_MODE unset/false so these
 * routes stay dark and cron jobs no-op.
 */

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
 * Monthly OTA-style pricing research + recommendations (agents).
 * Platform-only. Enable with PLATFORM_PRODUCT_MODE=true, or force with
 * PRICING_INTELLIGENCE_ENABLED=true for local testing.
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

/** Optional xAI / Grok key for richer competitor research narratives. */
export function pricingIntelligenceLlmConfigured(): boolean {
  return Boolean(
    process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  );
}

export const PLATFORM_ONLY_FEATURE_LABELS = [
  "Market pricing intelligence (monthly AI research + recommendations)",
  "OTA peer comps (Airbnb / VRBO / Booking-style capacity matching)",
  "Human-approved price apply (suggestion-only by default)",
] as const;
