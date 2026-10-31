/**
 * Build listing URL that carries search trip details into the booking widget.
 *
 * When `ambiguousSlugs` is passed (see ambiguousMarketplaceSlugs), ?host= is
 * only kept for slugs shared by more than one marketplace host — matching
 * marketplaceListingHref. Without it, ?host= is always included (legacy).
 */
export function listingHrefWithSearch(
  slug: string,
  hostSlug: string,
  search: {
    checkIn?: string;
    checkOut?: string;
    guests?: string | number;
    pets?: string | number;
  },
  ambiguousSlugs?: ReadonlySet<string>,
) {
  const params = new URLSearchParams();
  if (!ambiguousSlugs || ambiguousSlugs.has(slug)) params.set("host", hostSlug);
  if (search.checkIn) params.set("checkIn", String(search.checkIn));
  if (search.checkOut) params.set("checkOut", String(search.checkOut));
  if (search.guests) params.set("guests", String(search.guests));
  if (search.pets && Number(search.pets) > 0) {
    params.set("pets", String(search.pets));
  }
  const qs = params.toString();
  return qs
    ? `/marketplace/properties/${slug}?${qs}`
    : `/marketplace/properties/${slug}`;
}
