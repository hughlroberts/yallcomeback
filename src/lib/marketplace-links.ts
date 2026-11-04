/**
 * Public Find a Place page for one listing: /marketplace/properties/[slug],
 * scoped to its brand with ?host= (same URL the agent API returns).
 */
export function marketplaceListingHref(slug: string, hostSlug?: string | null): string {
  const path = `/marketplace/properties/${encodeURIComponent(slug)}`;
  return hostSlug ? `${path}?host=${encodeURIComponent(hostSlug)}` : path;
}
