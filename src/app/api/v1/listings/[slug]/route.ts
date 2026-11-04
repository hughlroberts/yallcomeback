import { NextRequest, NextResponse } from "next/server";
import { agentApiDisabledResponse } from "@/lib/agent/guard";
import { publicOrigin } from "@/lib/agent/origin";
import { getAgentListingDetail } from "@/lib/agent/listing";
import { SearchInputError } from "@/lib/agent/search";
import { partyFromParams } from "@/lib/search-filters";

export const dynamic = "force-dynamic";

/**
 * Public listing detail + availability for agents.
 * GET /api/v1/listings/{slug}?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2&pets=1
 * Dates follow the search rules: invalid, past or reversed dates get a 400
 * { ok: false, code, error }.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const disabled = agentApiDisabledResponse();
  if (disabled) return disabled;
  const { slug } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const origin = publicOrigin(req);

  // guests / pets: same parser and 400 codes as /api/v1/search, so a bad
  // value is never priced as 1 guest or carried into bookUrl.
  const party = partyFromParams((k) => sp.get(k));
  if (!party.ok) {
    return NextResponse.json(
      { ok: false, code: party.code, error: party.error },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  try {
    const listing = await getAgentListingDetail(origin, slug, {
      checkIn: sp.get("checkIn")?.trim() || undefined,
      checkOut: sp.get("checkOut")?.trim() || undefined,
      guests: party.guests,
      pets: party.pets,
    });

    if (!listing) {
      return NextResponse.json(
        { ok: false, error: "Listing not found or not on marketplace" },
        {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        version: "v1",
        listing,
        docs: `${origin}/llms.txt`,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    // Bad, past or reversed dates: same 400 shape and codes as /api/v1/search.
    if (e instanceof SearchInputError) {
      return NextResponse.json(
        { ok: false, code: e.code, error: e.message },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Listing fetch failed",
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
