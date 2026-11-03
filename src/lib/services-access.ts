import type { Host } from "@prisma/client";

export type ServicesAccessHost = Pick<Host, "hostingMode" | "sitePresence"> & {
  /** Platform admin override (no plan change). Missing = off. */
  servicesOverride?: boolean | null;
};

/**
 * True when this brand may use the Services page: a branded website
 * (paid plan or self-hosted), or a platform-admin override.
 */
export function hostCanUseServices(host: ServicesAccessHost): boolean {
  // Same rule as hostHasBrandedWebsite (lib/hosting), kept free of the DB
  // import so client and guest-site code can use it.
  const branded = host.hostingMode === "SELF" || host.sitePresence !== "STAYLOCAL";
  return branded || host.servicesOverride === true;
}

/** Services page is on and allowed. Use for routes, nav links and the editor. */
export function hostServicesPageOn(
  host: ServicesAccessHost & Pick<Host, "sitePageServices">,
): boolean {
  return host.sitePageServices && hostCanUseServices(host);
}
