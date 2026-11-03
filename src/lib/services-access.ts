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

/**
 * A guest may open only the Services page of a brand whose site is not
 * published, when a Platform admin turned on the override. The brand must
 * still be active (approved, live hosting). Nothing else of the brand opens.
 */
export function servicesOnlyGuestAllowed(
  host: ServicesAccessHost &
    Pick<Host, "sitePageServices" | "sitePublishState">,
  hostIsLive: boolean,
): boolean {
  return (
    hostIsLive &&
    host.sitePublishState === "UNPUBLISHED" &&
    host.servicesOverride === true &&
    hostServicesPageOn(host)
  );
}

/**
 * True when `pathname` is this brand's Services page (default /services or
 * the custom path). `basePath` is "/h/slug" on the platform, "" on a custom
 * domain.
 */
export function isServicesPagePath(
  pathname: string,
  basePath: string,
  segment: string,
): boolean {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  const base = (basePath || "").replace(/\/+$/, "");
  if (base && !clean.startsWith(`${base}/`)) return false;
  const rest = clean.slice(base.length);
  return rest === "/services" || rest === `/${segment}`;
}

/**
 * Badge text for Platform admin host lists. Null when the override is off.
 * Marketplace-only brands get the Services page only through the override.
 */
export function servicesOverrideBadgeLabel(
  host: ServicesAccessHost,
): string | null {
  if (host.servicesOverride !== true) return null;
  return "Services override";
}
