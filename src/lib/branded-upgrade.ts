/**
 * Marketplace → Branded website upgrade (T38).
 *
 * The plan changes only after the hosting checkout is paid. Picking Branded
 * opens a confirm page, then card checkout. A cancelled checkout changes
 * nothing. Complimentary brands are never billed, so they switch after the
 * confirm with no checkout.
 *
 * Pure helpers only (no DB / Stripe imports) so pages, actions and tests can
 * share them.
 */
import type { Host, HostingPlan } from "@prisma/client";

/** Checkout metadata flag on an upgrade session (session + subscription). */
export const BRANDED_UPGRADE_METADATA = { upgrade: "branded" } as const;

/** Plain-form POST target for hosting checkout / billing portal (T39). */
export const HOSTING_BILLING_ROUTE = "/api/billing/hosting";

export const SUBSCRIPTION_PATH = "/account/settings/subscription";

type UpgradeHost = Pick<Host, "hostingMode" | "sitePresence">;
type PlanPrice = Pick<HostingPlan, "monthlyPrice"> | null | undefined;

export function isComplimentaryPlanPrice(plan: PlanPrice): boolean {
  return Boolean(plan && plan.monthlyPrice <= 0);
}

/** Marketplace-only on the hosted platform: the upgrade applies. */
export function canUpgradeToBranded(host: UpgradeHost): boolean {
  return host.hostingMode === "PLATFORM" && host.sitePresence === "STAYLOCAL";
}

/**
 * True when moving this brand to Branded must go through paid checkout
 * (everything except complimentary brands).
 */
export function brandedUpgradeNeedsCheckout(
  host: UpgradeHost,
  plan: PlanPrice,
): boolean {
  return canUpgradeToBranded(host) && !isComplimentaryPlanPrice(plan);
}

/** Confirm page for the upgrade. `returnTo` must be an /admin or /account path. */
export function brandedUpgradeConfirmPath(
  hostId: string,
  returnTo?: string | null,
): string {
  const qs = new URLSearchParams({ hostId });
  const safe = safeBillingReturn(returnTo);
  if (safe) qs.set("returnTo", safe);
  return `${SUBSCRIPTION_PATH}/upgrade?${qs.toString()}`;
}

export function safeBillingReturn(returnTo?: string | null): string | null {
  const t = (returnTo || "").trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.startsWith("/admin") || t.startsWith("/account")) return t;
  return null;
}

export function isBrandedUpgradeMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  return metadata?.upgrade === BRANDED_UPGRADE_METADATA.upgrade;
}

/**
 * A paid Branded brand that has not paid yet (no live hosting
 * subscription). Guests do not see the branded site in this state
 * (isHostPublicLive); show a pending banner with a Pay button.
 */
export function brandedAwaitingPayment(
  host: Pick<Host, "hostingMode" | "sitePresence" | "subscriptionStatus">,
  plan: PlanPrice,
): boolean {
  if (host.hostingMode !== "PLATFORM") return false;
  if (host.sitePresence === "STAYLOCAL") return false;
  if (isComplimentaryPlanPrice(plan)) return false;
  return (
    host.subscriptionStatus === "PENDING_PAYMENT" ||
    host.subscriptionStatus === "NONE" ||
    host.subscriptionStatus === "CANCELLED"
  );
}

export type BillingErrorCode =
  | "stripe_off"
  | "price_missing"
  | "no_email"
  | "forbidden"
  | "has_subscription"
  | "not_marketplace"
  | "not_branded"
  | "failed";

export function billingErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "stripe_off":
    case "price_missing":
      return "Card checkout is not set up yet. Nothing changed. Try again later or contact support.";
    case "no_email":
      return "Add a billing or contact email on this brand, then try again.";
    case "forbidden":
      return "You cannot manage billing for this brand.";
    case "has_subscription":
      return "This brand already has a card subscription. Nothing changed. Contact support to change the plan.";
    case "not_marketplace":
      return "This brand is already on the Branded website plan.";
    case "not_branded":
      return "Card checkout is the $25 / month branded website plan. Marketplace-only brands are billed per listing by invoice.";
    case "failed":
      return "Checkout could not start. Nothing changed. Try again.";
    default:
      return null;
  }
}
