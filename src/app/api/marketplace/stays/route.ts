import { NextRequest, NextResponse } from "next/server";
import { getMarketplaceListings } from "@/lib/host";

/**
 * JSON marketplace search for guest discovery carousels
 * (based on your previous search, stay in place, etc.).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where = sp.get("where")?.trim() || undefined;
  const checkIn = sp.get("checkIn")?.trim() || undefined;
  const checkOut = sp.get("checkOut")?.trim() || undefined;
  const guestsRaw = sp.get("guests");
  const petsRaw = sp.get("pets");
  const takeRaw = sp.get("take");
  const dateFlexRaw = sp.get("dateFlex") || sp.get("flexibilityDays");

  const guests = guestsRaw ? Number(guestsRaw) : undefined;
  const pets = petsRaw ? Number(petsRaw) : undefined;
  const take = takeRaw ? Math.min(24, Math.max(1, Number(takeRaw) || 12)) : 12;
  const dateFlex = dateFlexRaw ? Number(dateFlexRaw) : undefined;

  const listings = await getMarketplaceListings({
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
  });

  return NextResponse.json({
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
      host: p.host
        ? { name: p.host.name, slug: p.host.slug }
        : null,
    })),
  });
}
