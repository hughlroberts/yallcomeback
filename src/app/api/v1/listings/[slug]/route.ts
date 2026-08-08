import { NextRequest, NextResponse } from "next/server";
import { publicOrigin } from "@/lib/agent/origin";
import { getAgentListingDetail } from "@/lib/agent/listing";

export const dynamic = "force-dynamic";

/**
 * Public listing detail + availability for agents.
 * GET /api/v1/listings/{slug}?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&pets=1
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const origin = publicOrigin(req);

  try {
    const listing = await getAgentListingDetail(origin, slug, {
      checkIn: sp.get("checkIn")?.trim() || undefined,
      checkOut: sp.get("checkOut")?.trim() || undefined,
      guests: sp.get("guests") ? Number(sp.get("guests")) : undefined,
      pets: sp.get("pets") ? Number(sp.get("pets")) : undefined,
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
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
