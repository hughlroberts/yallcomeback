/** Build listing URL that carries search trip details into the booking widget. */
export function listingHrefWithSearch(
  slug: string,
  hostSlug: string,
  search: {
    checkIn?: string;
    checkOut?: string;
    guests?: string | number;
    pets?: string | number;
  },
) {
  const params = new URLSearchParams();
  params.set("host", hostSlug);
  if (search.checkIn) params.set("checkIn", String(search.checkIn));
  if (search.checkOut) params.set("checkOut", String(search.checkOut));
  if (search.guests) params.set("guests", String(search.guests));
  if (search.pets && Number(search.pets) > 0) {
    params.set("pets", String(search.pets));
  }
  return `/marketplace/properties/${slug}?${params.toString()}`;
}
