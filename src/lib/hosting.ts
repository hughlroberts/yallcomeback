import type {
  Host,
  HostingMode,
  HostApprovalStatus,
  HostingSubStatus,
  HostingPlan,
  HostingPricingModel,
  HostSitePresence,
  SetupServiceStatus,
} from "@prisma/client";

/** One-time done-for-you setup: listings, brand, custom domain / website. */
export const SETUP_SERVICE_FEE_USD = 500;

export const SETUP_SERVICE_LABEL =
  "Full setup (listings, brand & website)";

export function setupServiceLabel(status: SetupServiceStatus): string {
  switch (status) {
    case "NONE":
      return "Not requested";
    case "REQUESTED":
      return "Requested";
    case "INVOICED":
      return "Invoiced";
    case "PAID":
      return "Paid";
    case "WAIVED":
      return "Waived";
    default:
      return status;
  }
}

export type HostLiveFields = Pick<
  Host,
  | "active"
  | "hostingMode"
  | "approvalStatus"
  | "subscriptionStatus"
>;

/** Public site + marketplace require a live, paid (or self) host */
export function isHostPublicLive(host: HostLiveFields): boolean {
  if (!host.active) return false;
  if (host.approvalStatus !== "APPROVED") return false;
  if (host.hostingMode === "SELF") return true;
  return host.subscriptionStatus === "ACTIVE";
}

/**
 * @deprecated Marketplace is always optional for every host (paid and self-host).
 * Kept as a no-op false so older call sites that forced marketplace stop doing so.
 */
export function hostMustListOnMarketplace(
  _host: Pick<Host, "hostingMode">,
): boolean {
  return false;
}

/** Effective marketplace switch — host flag only (optional for self-host too). */
export function hostListsOnMarketplace(
  host: Pick<Host, "hostingMode" | "listOnMarketplace">,
): boolean {
  return host.listOnMarketplace;
}

export function sitePresenceLabel(mode: HostSitePresence): string {
  switch (mode) {
    case "STAYLOCAL":
      return "Yall Come Back listing URLs";
    case "CUSTOM":
      return "Own domain / website";
    case "BOTH":
      return "Yall Come Back + own domain";
    default:
      return mode;
  }
}

/**
 * Guest-facing primary website for the host brand (not a listing URL).
 * null means Yall Come Back marketplace listings are the only public surface.
 */
export function hostBrandWebsite(
  host: Pick<Host, "sitePresence" | "websiteUrl" | "hostingMode">,
): string | null {
  const url = host.websiteUrl?.trim() || null;
  if (host.hostingMode === "SELF") return url;
  if (host.sitePresence === "STAYLOCAL") return null;
  return url;
}

/** Whether Yall Come Back marketplace listing pages are a public surface for this host. */
export function hostUsesPlatformListings(
  host: Pick<Host, "sitePresence" | "hostingMode" | "listOnMarketplace">,
): boolean {
  // Marketplace opt-in is host-controlled for both paid and free self-host
  if (!host.listOnMarketplace) return false;
  if (host.sitePresence === "CUSTOM" && host.hostingMode === "PLATFORM") {
    // Custom-only paid hosts may still opt in via listOnMarketplace
    return true;
  }
  return true;
}

export function canHostEditAdmin(host: HostLiveFields): boolean {
  // Hosts can build their site while pending review / awaiting payment
  return (
    host.active &&
    host.approvalStatus !== "REJECTED" &&
    host.approvalStatus !== "SUSPENDED"
  );
}

export function approvalLabel(status: HostApprovalStatus): string {
  switch (status) {
    case "PENDING_REVIEW":
      return "Pending review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "SUSPENDED":
      return "Suspended";
    default:
      return status;
  }
}

export function subscriptionLabel(status: HostingSubStatus): string {
  switch (status) {
    case "NONE":
      return "No subscription";
    case "PENDING_PAYMENT":
      return "Awaiting hosting payment";
    case "ACTIVE":
      return "Active";
    case "PAST_DUE":
      return "Past due";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

export function hostingModeLabel(mode: HostingMode): string {
  return mode === "PLATFORM"
    ? "Paid platform hosting"
    : "Free self-host";
}

export function pricingModelLabel(model: HostingPricingModel): string {
  return model === "PER_PROPERTY" ? "Per property / month" : "Flat / month";
}

/** Billable units: published properties, floored at plan.minProperties */
export function billablePropertyCount(
  publishedCount: number,
  plan: Pick<HostingPlan, "pricingModel" | "minProperties">
): number {
  if (plan.pricingModel === "FLAT") return 1;
  return Math.max(plan.minProperties, publishedCount);
}

export function calculateHostingAmount(
  plan: Pick<HostingPlan, "monthlyPrice" | "pricingModel" | "minProperties">,
  publishedPropertyCount: number
): { amount: number; propertyCount: number; unitPrice: number } {
  const unitPrice = plan.monthlyPrice;
  if (plan.pricingModel === "FLAT") {
    return { amount: unitPrice, propertyCount: 1, unitPrice };
  }
  const propertyCount = billablePropertyCount(publishedPropertyCount, plan);
  return {
    amount: Math.round(unitPrice * propertyCount * 100) / 100,
    propertyCount,
    unitPrice,
  };
}

export function formatPlanPrice(
  plan: Pick<HostingPlan, "monthlyPrice" | "pricingModel" | "currency">,
  formatMoney: (n: number, symbol?: string) => string
): string {
  if (plan.monthlyPrice <= 0) {
    return plan.pricingModel === "PER_PROPERTY"
      ? "Free / listing / mo"
      : "Free / mo";
  }
  const money = formatMoney(plan.monthlyPrice);
  return plan.pricingModel === "PER_PROPERTY"
    ? `${money}/property/mo`
    : `${money}/mo`;
}

export function isComplimentaryPlan(
  plan: Pick<HostingPlan, "monthlyPrice"> | null | undefined,
): boolean {
  return Boolean(plan && plan.monthlyPrice <= 0);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = startOfDay(date).getTime() - startOfDay(new Date()).getTime();
  return Math.ceil(ms / 86400000);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
