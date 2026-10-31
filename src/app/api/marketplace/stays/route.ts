import { NextRequest, NextResponse } from "next/server";
import { searchMarketplace } from "@/lib/host";
import { ambiguousMarketplaceSlugs } from "@/lib/marketplace-slugs";
import { checkSearchDates } from "@/lib/search-dates";
import { listingFiltersFromParams, searchLimitFromParams } from "@/lib/search-filters";

/**
 * JSON marketplace search for guest discovery carousels
 * (based on your previous search, stay in place, etc.).
 * limit (alias take): default 20, max 50 — same as /api/v1/search.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where = sp.get("where")?.trim() || undefined;
  const checkIn = sp.get("checkIn")?.trim() || undefined;
  const checkOut = sp.get("checkOut")?.trim() || undefined;
  const guestsRaw = sp.get("guests");
  const petsRaw = sp.get("pets");
  const dateFlexRaw = sp.get("dateFlex") || sp.get("flexibilityDays");

  const guests = guestsRaw ? Number(guestsRaw) : undefined;
  const pets = petsRaw ? Number(petsRaw) : undefined;
  // take / limit: same default (20) and max (50) as /api/v1/search.
  const take = searchLimitFromParams((k) => sp.get(k));
  const dateFlex = dateFlexRaw ? Number(dateFlexRaw) : undefined;

  // Past, inverted or malformed dates are a client error, never ignored.
  const dates = checkSearchDates(checkIn, checkOut);
  if (!dates.ok) {
    return NextResponse.json(
      { ok: false, code: dates.code, error: dates.error },
      { status: 400 },
    );
  }
  const filters = listingFiltersFromParams((k) => sp.get(k));

  const { listings, total, flexibleDates } = await searchMarketplace(
    {
      q: where,
      checkIn,
      checkOut,
      dateFlex:
        dateFlex != null && Number.isFinite(dateFlex) && dateFlex > 0
          ? Math.min(14, Math.floor(dateFlex))
          : undefined,
      guests:
        guests != null && Number.isFinite(guests) && guests > 0
          ? Math.floor(guests)
          : undefined,
      pets:
        pets != null && Number.isFinite(pets) && pets > 0
          ? Math.floor(pets)
          : undefined,
      take,
    },
    { withFlexibleDates: true, withTotal: true, filters },
  );

  const ambiguous = await ambiguousMarketplaceSlugs(
    listings.map((p) => p.slug),
  );

  return NextResponse.json({
    /** All matching stays (not cut to take); agrees with flexibleDates.currentCount. */
    count: total,
    /** Listings in this response (at most take / limit). */
    returned: listings.length,
    /** Stays matching the current search; equals count and flexibleDates.currentCount. */
    currentCount: flexibleDates?.currentCount ?? total,
    listings: listings.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagline: p.tagline,
      city: p.city,
      region: p.region,
      baseNightlyRate: p.baseNightlyRate,
      maxGuests: p.maxGuests,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      images: p.images.map((img) => ({
        url: img.url,
        alt: img.alt,
      })),
      host: p.host ? { name: p.host.name, slug: p.host.slug } : null,
      /** Another marketplace host uses this slug → link needs ?host= */
      slugShared: ambiguous.has(p.slug),
    })),
    /**
     * Exact dates + limited results → nearby date windows with more stays
     * ({ currentCount, minStay, suggestions[{checkIn, checkOut, nights,
     * count, label, searchPath}] }). null when there is nothing better.
     */
    flexibleDates,
  });
}
