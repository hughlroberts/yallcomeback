/**
 * K1-c (revised): a public /h/<brand>/ demo site is included on every plan,
 * including Marketplace only. The Branded website plan (and complimentary
 * hosted / self-host) is what includes a custom domain.
 */

export const MARKETPLACE_PLAN_SLUG = "marketplace";
export const BRANDED_PLAN_SLUG = "branded";
export const COMPLIMENTARY_PLAN_SLUG = "complimentary";

export type PlanForCustomDomain = { slug: string } | null | undefined;

export function planIncludesCustomDomain(host: {
  hostingMode?: string | null;
  plan?: PlanForCustomDomain;
}): boolean {
  if (host.hostingMode === "SELF") return true;
  const slug = host.plan?.slug;
  return slug === BRANDED_PLAN_SLUG || slug === COMPLIMENTARY_PLAN_SLUG;
}

/** @deprecated Use planIncludesCustomDomain. Same check: the $25 plan is for a custom domain, not /h/. */
export const planIncludesBrandedSite = planIncludesCustomDomain;

/**
 * Map a request path on a host custom domain to the platform /h/<brand>/ path
 * so a Marketplace-only brand is not served on that domain.
 */
export function customDomainToPlatformPath(
  hostSlug: string,
  pathname: string,
): string {
  const slug = hostSlug.toLowerCase();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (path === `/h/${slug}` || path.startsWith(`/h/${slug}/`)) return path;

  if (path === "/" || path === "") return `/h/${slug}`;
  if (path === "/about" || path.startsWith("/about/")) return `/h/${slug}/about`;
  if (path === "/services" || path.startsWith("/services/")) {
    return `/h/${slug}/services`;
  }
  if (path === "/contact" || path.startsWith("/contact/")) {
    return `/h/${slug}/contact`;
  }
  if (path === "/stays" || path === "/marketplace" || path === "/properties") {
    return `/h/${slug}/stays`;
  }
  if (path.startsWith("/book/")) return `/h/${slug}${path}`;
  if (path.startsWith("/marketplace/properties/")) {
    return `/h/${slug}/properties/${path.slice("/marketplace/properties/".length)}`;
  }
  if (path.startsWith("/properties/")) {
    const propertySlug = path.slice("/properties/".length).split("/")[0];
    if (propertySlug) return `/h/${slug}/properties/${propertySlug}`;
  }
  if (path.startsWith("/h/")) return `/h/${slug}`;
  return `/h/${slug}${path}`;
}
