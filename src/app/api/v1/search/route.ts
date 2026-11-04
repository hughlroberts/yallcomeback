import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import { agentSearch, SearchInputError } from "@/lib/agent/search";
import {
  partyFromParams,
  strictSearchLimitFromParams,
} from "@/lib/search-filters";

export const dynamic = "force-dynamic";

/**
 * Public agent search API.
 * GET /api/v1/search?location=Cedar+Creek&checkIn=2026-08-15&checkOut=2026-08-18&flexible=true&flexibilityDays=3
 */
export async function GET(req: NextRequest) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  const sp = req.nextUrl.searchParams;
  const origin = publicOrigin(req);

  const location =
    sp.get("location")?.trim() ||
    sp.get("where")?.trim() ||
    sp.get("q")?.trim() ||
    sp.get("lake")?.trim() ||
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

  // guests / pets: whole numbers or 400 invalid_guests / invalid_pets
  // (shared with /api/marketplace/stays and /api/v1/listings/{slug}).
  const party = partyFromParams((k) => sp.get(k));
  if (!party.ok) {
    return NextResponse.json(
      { ok: false, code: party.code, error: party.error },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const { guests, pets } = party;
  const bedrooms = sp.get("bedrooms") ? Number(sp.get("bedrooms")) : undefined;
  const minNightly = sp.get("minNightly")
    ? Number(sp.get("minNightly"))
    : undefined;
  const maxNightly = sp.get("maxNightly")
    ? Number(sp.get("maxNightly"))
    : undefined;
  // Default 20; otherwise a whole number 1–50 or 400 invalid_limit (same
  // parser as /api/marketplace/stays).
  const limit = strictSearchLimitFromParams((k) => sp.get(k));
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, code: "invalid_limit", error: limit.error },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const take = limit.take;

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
      guests,
      pets: pets != null && pets > 0 ? pets : undefined,
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
      take,
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
    if (e instanceof SearchInputError) {
      return NextResponse.json(
        { ok: false, code: e.code, error: e.message },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
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
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
