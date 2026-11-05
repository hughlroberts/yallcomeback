import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import { agentSearch, SearchInputError } from "@/lib/agent/search";
import {
  SEARCH_MAX_FLEXIBILITY_DAYS,
  SEARCH_MAX_LOCATION_CHARS,
  plainWholeNumber,
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

  const bad = (code: string, error: string) =>
    NextResponse.json(
      { ok: false, code, error },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  if (location && location.length > SEARCH_MAX_LOCATION_CHARS) {
    return bad(
      "invalid_location",
      `location must be ${SEARCH_MAX_LOCATION_CHARS} characters or fewer (got ${location.length}).`,
    );
  }
  // R1104-12: dates come as a pair. A lone checkIn/checkOut is a 400
  // rather than being silently ignored.
  if (Boolean(checkIn) !== Boolean(checkOut)) {
    return bad(
      "incomplete_dates",
      "checkIn and checkOut must be sent together (or neither, for any dates).",
    );
  }

  const flexibleRaw = sp.get("flexible")?.trim().toLowerCase();
  const flexible =
    flexibleRaw === "1" ||
    flexibleRaw === "true" ||
    flexibleRaw === "yes" ||
    // Homepage “I’m flexible” often means no dates
    (!checkIn && !checkOut && sp.get("imFlexible") === "1");

  const flexibilityDaysRaw =
    sp.get("flexibilityDays") || sp.get("dateFlex") || sp.get("flex");
  let flexibilityDays: number | undefined;
  if (flexibilityDaysRaw?.trim()) {
    const n = plainWholeNumber(flexibilityDaysRaw.trim());
    if (n == null || n < 0 || n > SEARCH_MAX_FLEXIBILITY_DAYS) {
      return bad(
        "invalid_flexibility_days",
        `flexibilityDays must be a whole number from 0 to ${SEARCH_MAX_FLEXIBILITY_DAYS} (got "${flexibilityDaysRaw.slice(0, 40)}").`,
      );
    }
    flexibilityDays = n;
  }

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
  // Non-numeric or negative prices used to be dropped silently.
  for (const [name, v] of [
    ["minNightly", minNightly],
    ["maxNightly", maxNightly],
  ] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0)) {
      return bad(
        "invalid_price_range",
        `${name} must be a number of 0 or more (got "${String(sp.get(name)).slice(0, 40)}").`,
      );
    }
  }
  if (
    minNightly != null &&
    maxNightly != null &&
    Number.isFinite(minNightly) &&
    Number.isFinite(maxNightly) &&
    minNightly > maxNightly
  ) {
    return bad(
      "invalid_price_range",
      `minNightly (${minNightly}) must not be greater than maxNightly (${maxNightly}).`,
    );
  }
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
