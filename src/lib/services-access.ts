import type { Host } from "@prisma/client";

export type ServicesAccessHost = Pick<Host, "hostingMode" | "sitePresence">;

/**
 * True when this brand may use the Services page: Branded website plan only
 * (or self-hosted). Marketplace-only brands get it when they move to Branded.
 * There is no override (Host.servicesOverride is deprecated and not read).
 */
export function hostCanUseServices(host: ServicesAccessHost): boolean {
  // Same rule as hostHasBrandedWebsite (lib/hosting), kept free of the DB
  // import so client and guest-site code can use it.
  return host.hostingMode === "SELF" || host.sitePresence !== "STAYLOCAL";
}

/** Services page is on and allowed. Use for routes, nav links and the editor. */
export function hostServicesPageOn(
  host: ServicesAccessHost & Pick<Host, "sitePageServices">,
): boolean {
  return host.sitePageServices && hostCanUseServices(host);
}
