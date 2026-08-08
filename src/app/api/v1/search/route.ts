import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/agent/origin";
import { agentSearch } from "@/lib/agent/search";

export const dynamic = "force-dynamic";

/**
 * Public agent search API.
 * GET /api/v1/search?location=Cedar+Creek&checkIn=2026-08-15&checkOut=2026-08-18&flexible=true&flexibilityDays=3
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const origin = publicOrigin(req);

  const location =
    sp.get("location")?.trim() ||
    sp.get("where")?.trim() ||
    sp.get("q")?.trim() ||
    undefined;

  const checkIn = sp.get("checkIn")?.trim() || undefined;
  const checkOut = sp.get("checkOut")?.trim() || undefined;

  const flexibleRaw = sp.get("flexible")?.trim().toLowerCase();
  const flexible =
    flexibleRaw === "1" ||
    flexibleRaw === "true" ||
    flexibleRaw === "yes" ||
    // Homepage “I’m flexible” often means no dates
    (!checkIn && !checkOut && sp.get("imFlexible") === "1");

  const flexibilityDaysRaw =
    sp.get("flexibilityDays") || sp.get("dateFlex") || sp.get("flex");
  const flexibilityDays = flexibilityDaysRaw
    ? Number(flexibilityDaysRaw)
    : undefined;

  const guests = sp.get("guests") ? Number(sp.get("guests")) : undefined;
  const pets = sp.get("pets") ? Number(sp.get("pets")) : undefined;
  const bedrooms = sp.get("bedrooms") ? Number(sp.get("bedrooms")) : undefined;
  const minNightly = sp.get("minNightly")
    ? Number(sp.get("minNightly"))
    : undefined;
  const maxNightly = sp.get("maxNightly")
    ? Number(sp.get("maxNightly"))
    : undefined;
  const take = sp.get("take") || sp.get("limit")
    ? Number(sp.get("take") || sp.get("limit"))
    : undefined;

  const amenitiesRaw = sp.get("amenities") || sp.get("amenity");
  const amenities = amenitiesRaw
    ? amenitiesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  try {
    const result = await agentSearch(origin, {
      location,
      checkIn,
      checkOut,
      flexible,
      flexibilityDays:
        flexibilityDays != null && Number.isFinite(flexibilityDays)
          ? flexibilityDays
          : undefined,
      guests:
        guests != null && Number.isFinite(guests) && guests > 0
          ? Math.floor(guests)
          : undefined,
      pets:
        pets != null && Number.isFinite(pets) && pets > 0
          ? Math.floor(pets)
          : undefined,
      bedrooms:
        bedrooms != null && Number.isFinite(bedrooms) && bedrooms > 0
          ? Math.floor(bedrooms)
          : undefined,
      minNightly:
        minNightly != null && Number.isFinite(minNightly)
          ? minNightly
          : undefined,
      maxNightly:
        maxNightly != null && Number.isFinite(maxNightly)
          ? maxNightly
          : undefined,
      amenities,
      take:
        take != null && Number.isFinite(take) ? Math.floor(take) : undefined,
    });

    return NextResponse.json(
      {
        ok: true,
        version: "v1",
        ...result,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Search failed",
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
