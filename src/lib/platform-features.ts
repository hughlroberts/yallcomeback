/**
 * Features that ship only on the hosted Yall Come Back platform / marketplace —
 * NOT part of the MIT open-source self-host product.
 *
 * Pricing intelligence is also a paid $35/mo add-on and is rolled out host-by-host
 * (secret beta). Not advertised in open-source marketing.
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
 * Set PLATFORM_PRODUCT_MODE=true on main product deploys.
 * Set YCB_OPEN_SOURCE_BUILD=true on MIT self-host builds to force off.
 */
export function isPlatformProductMode(): boolean {
  if (process.env.YCB_OPEN_SOURCE_BUILD?.trim().toLowerCase() === "true") {
    return false;
  }
  const raw = process.env.PLATFORM_PRODUCT_MODE?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

function envFlag(
  name: string,
  whenUnset: () => boolean,
): boolean {
  if (process.env.YCB_OPEN_SOURCE_BUILD?.trim().toLowerCase() === "true") {
    return false;
  }
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return whenUnset();
}

/**
 * Public agent API (/llms.txt, /agents.md, /api/v1, ai-plugin).
 * Paid hosted Yall Come Back only — off on MIT self-host copies.
 */
export function isAgentApiEnabled(): boolean {
  return envFlag("AGENT_API_ENABLED", isPlatformProductMode);
}

/**
 * Airbnb/VRBO listing import UI + actions.
 * Paid platform hosting only — off on self-host copies and SELF hosts.
 */
export function isListingImportAgentEnabled(): boolean {
  return envFlag("LISTING_IMPORT_AGENT_ENABLED", isPlatformProductMode);
}

export function canUseListingImportAgent(host: {
  hostingMode: string;
} | null | undefined): boolean {
  if (!isListingImportAgentEnabled()) return false;
  if (!host) return false;
  return host.hostingMode === "PLATFORM";
}

/**
 * Calendar iCal setup agent (extract ICS URLs from messy paste via Grok).
 * Core two-way iCal stays MIT; LLM extract is paid platform hosting.
 */
export function isIcalSetupAgentEnabled(): boolean {
  return envFlag("ICAL_SETUP_AGENT_ENABLED", isPlatformProductMode);
}

export function canUseIcalSetupAgent(host: {
  hostingMode: string;
} | null | undefined): boolean {
  if (!isIcalSetupAgentEnabled()) return false;
  if (!host) return false;
  return host.hostingMode === "PLATFORM";
}

/**
 * Feature exists on this deploy (platform product). Does not mean a given host
 * is allowed or paid — use canAccessPricingIntelligence / canRunPricingIntelligence.
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

/** Host has paid $35/mo (ops set ACTIVE after payment). */
export function hostHasPricingIntelligenceAddon(host: {
  pricingIntelligenceAddonStatus: PricingAddonStatus | string;
}): boolean {
  return host.pricingIntelligenceAddonStatus === "ACTIVE";
}

/**
 * Host is allowed to see Pricing in admin (beta rollout toggle).
 * Platform ADMIN always can open the tool; hosts need this flag + paid ACTIVE to run.
 */
export function hostHasPricingIntelligenceAccess(host: {
  pricingIntelligenceEnabled?: boolean | null;
}): boolean {
  return Boolean(host.pricingIntelligenceEnabled);
}

/**
 * Host may start research runs / monthly cron includes them.
 * Requires: deploy feature on + beta access + paid ACTIVE.
 * Platform admin can still bypass via run options for support.
 */
export function canRunPricingIntelligence(host: {
  pricingIntelligenceEnabled?: boolean | null;
  pricingIntelligenceAddonStatus: PricingAddonStatus | string;
}): boolean {
  if (!isPricingIntelligenceEnabled()) return false;
  return (
    hostHasPricingIntelligenceAccess(host) &&
    hostHasPricingIntelligenceAddon(host)
  );
}

/**
 * Who can open pricing intelligence (Ops → Pricing intelligence for now).
 * - Platform ADMIN: always (secret ops tool — not in host Admin yet)
 * - HOST: only if ops enabled access for their brand, once published there
 */
export function canSeePricingIntelligenceNav(opts: {
  isPlatformAdmin: boolean;
  host?: {
    pricingIntelligenceEnabled?: boolean | null;
  } | null;
}): boolean {
  if (!isPricingIntelligenceEnabled()) return false;
  if (opts.isPlatformAdmin) return true;
  return hostHasPricingIntelligenceAccess(opts.host ?? {});
}

export function pricingAddonStatusLabel(
  status: PricingAddonStatus | string,
): string {
  switch (status) {
    case "NONE":
      return "Not subscribed";
    case "REQUESTED":
      return "Requested — awaiting payment";
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

/** Internal only — not listed on /open-source FEATURE_GROUPS. */
export const PLATFORM_ONLY_FEATURE_LABELS = [
  "Public agent API (llms.txt, agents.md, /api/v1) — paid hosted product",
  "Listing import from Airbnb/VRBO — paid platform hosting",
  "iCal setup agent (extract ICS URLs from pasted host settings)",
  "Market pricing intelligence add-on ($35/mo — not in hosting fee)",
  "Per-host beta toggle (ops rollout)",
  "OTA peer comps (capacity matching)",
  "Human-approved price apply",
] as const;
