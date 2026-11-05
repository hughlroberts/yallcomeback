import { NextRequest, NextResponse } from "next/server";
import { searchMarketplace } from "@/lib/host";
import { ambiguousMarketplaceSlugs } from "@/lib/marketplace-slugs";
import { checkSearchDates } from "@/lib/search-dates";
import {
  SEARCH_MAX_LOCATION_CHARS,
  lenientFlexibilityDays,
  listingFiltersFromParams,
  partyFromParams,
  strictSearchLimitFromParams,
} from "@/lib/search-filters";

/**
 * JSON marketplace search for guest discovery carousels
 * (based on your previous search, stay in place, etc.).
 * limit (alias take): default 20, max 50 — same parser and 400 invalid_limit
 * as /api/v1/search; guests / pets: 400 invalid_guests / invalid_pets.
 * where is trimmed to 200 chars; dateFlex / flexibilityDays is clamped to
 * 0–14 (or 0 when not a number) so saved-search carousels never 400.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Same 200-char cut as the /marketplace page (UI carousels replay saved
  // searches, so trim instead of a 400).
  const where =
    sp.get("where")?.trim().slice(0, SEARCH_MAX_LOCATION_CHARS).trim() ||
    undefined;
  const checkIn = sp.get("checkIn")?.trim() || undefined;
  const checkOut = sp.get("checkOut")?.trim() || undefined;
  // dateFlex: clamp / default (never 400) — same spirit as where trim.
  const dateFlex = lenientFlexibilityDays(
    sp.get("dateFlex") || sp.get("flexibilityDays"),
  );

  // take / limit: same strict parser as /api/v1/search (default 20, whole
  // number 1–50, else 400 invalid_limit).
  const limit = strictSearchLimitFromParams((k) => sp.get(k));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, code: "invalid_limit", error: limit.error },
      { status: 400 },
    );
  }
  const take = limit.take;
  const party = partyFromParams((k) => sp.get(k));
  if (!party.ok) {
    return NextResponse.json(
      { ok: false, code: party.code, error: party.error },
      { status: 400 },
    );
  }
  const { guests, pets } = party;

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
      dateFlex: dateFlex > 0 ? dateFlex : undefined,
      guests,
      pets: pets != null && pets > 0 ? pets : undefined,
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
