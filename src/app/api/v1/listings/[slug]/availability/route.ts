import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";
import { publicOrigin } from "@/lib/agent/origin";
import { findAvailableWindows } from "@/lib/agent/availability";
import { addDaysYmd, formatYmd, isYmd } from "@/lib/search-dates";

export const dynamic = "force-dynamic";

/**
 * Availability windows + blocked ranges for a marketplace listing.
 * GET /api/v1/listings/{slug}/availability?nights=3&from=2026-08-01&days=90
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const origin = publicOrigin(req);

  const property = await prisma.property.findFirst({
    where: { slug, ...marketplacePropertyWhere() },
    select: {
      id: true,
      slug: true,
      defaultMinNights: true,
      title: true,
    },
  });

  if (!property) {
    return NextResponse.json(
      { ok: false, error: "Listing not found" },
      {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }

  const nightsRaw = sp.get("nights");
  const nights = nightsRaw
    ? Math.max(1, Math.floor(Number(nightsRaw) || 1))
    : Math.max(2, property.defaultMinNights || 1);
  const from =
    sp.get("from") && isYmd(sp.get("from")!)
      ? sp.get("from")!
      : formatYmd(new Date());
  const lookAhead = Math.min(
    180,
    Math.max(14, Number(sp.get("days") || sp.get("lookAhead") || 90)),
  );
  const maxWindows = Math.min(
    30,
    Math.max(1, Number(sp.get("maxWindows") || 10)),
  );

  const windows = await findAvailableWindows({
    propertyId: property.id,
    nights,
    fromYmd: from,
    lookAheadDays: lookAhead,
    maxWindows,
    minNights: property.defaultMinNights,
  });

  const rangeEnd = addDaysYmd(from, lookAhead);
  const blocks = await prisma.calendarBlock.findMany({
    where: {
      propertyId: property.id,
      startDate: { lt: new Date(`${rangeEnd}T12:00:00`) },
      endDate: { gt: new Date(`${from}T12:00:00`) },
    },
    select: { startDate: true, endDate: true, source: true },
    orderBy: { startDate: "asc" },
    take: 200,
  });

  return NextResponse.json(
    {
      ok: true,
      version: "v1",
      slug: property.slug,
      title: property.title,
      nights,
      from,
      lookAheadDays: lookAhead,
      availableWindows: windows,
      blockedRanges: blocks.map((b) => ({
        start: formatYmd(b.startDate),
        end: formatYmd(b.endDate),
        source: b.source,
      })),
      listingApi: `${origin}/api/v1/listings/${encodeURIComponent(property.slug)}`,
      docs: `${origin}/llms.txt`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
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
