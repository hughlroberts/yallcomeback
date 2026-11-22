/**
 * K1-c: a public branded host site (/h/<brand>/) is included on the Branded
 * website plan and on complimentary hosted brands, not on Marketplace only.
 * Open-source / self-host is not the Marketplace-only product, so it stays
 * entitled. Check entitlement here; do not infer it from sitePresence alone.
 */

export const MARKETPLACE_PLAN_SLUG = "marketplace";
export const BRANDED_PLAN_SLUG = "branded";
export const COMPLIMENTARY_PLAN_SLUG = "complimentary";

export type PlanForBrandedSite = { slug: string } | null | undefined;

export function planIncludesBrandedSite(host: {
  hostingMode?: string | null;
  plan?: PlanForBrandedSite;
}): boolean {
  if (host.hostingMode === "SELF") return true;
  const slug = host.plan?.slug;
  return slug === BRANDED_PLAN_SLUG || slug === COMPLIMENTARY_PLAN_SLUG;
}

function searchFrom(
  search?: Record<string, string | undefined> | URLSearchParams | string,
): URLSearchParams {
  if (!search) return new URLSearchParams();
  if (typeof search === "string") {
    return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  }
  if (search instanceof URLSearchParams) return new URLSearchParams(search);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) {
    if (v != null && v !== "") q.set(k, v);
  }
  return q;
}

function withQuery(path: string, q: URLSearchParams): string {
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Marketplace equivalent of a branded /h/<brand>/... path.
 * Property pages go to /marketplace/properties/<slug>?host=<brand> so existing
 * guest links keep working. Booking/confirmation stay on the shared /book
 * routes. Other branded pages (home, stays, legal, help) go to /marketplace.
 */
export function brandedSiteGuestFallback(
  hostSlug: string,
  pathWithinBrand: string,
  search?: Record<string, string | undefined> | URLSearchParams | string,
): string {
  const path = pathWithinBrand.startsWith("/")
    ? pathWithinBrand
    : `/${pathWithinBrand}`;
  const q = searchFrom(search);
  q.delete("via");

  const prop = path.match(/^\/properties\/([^/]+)\/?$/);
  if (prop) {
    if (!q.has("host")) q.set("host", hostSlug);
    return withQuery(`/marketplace/properties/${prop[1]}`, q);
  }

  const book = path.match(/^\/book\/([^/]+)\/?$/);
  if (book && book[1] !== "confirmation") {
    if (!q.has("host")) q.set("host", hostSlug);
    return withQuery(`/book/${book[1]}`, q);
  }

  const conf = path.match(/^\/book\/confirmation\/([^/]+)\/?$/);
  if (conf) {
    return withQuery(`/book/confirmation/${conf[1]}`, q);
  }

  return "/marketplace";
}
