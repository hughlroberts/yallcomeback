import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordPropertyView } from "@/lib/listing-insights";
import { actorIsInternal, trackAnalyticsEvent } from "@/lib/analytics";
import { hasInternalCookieHeader } from "@/lib/analytics-internal";
import { incomingIpFromRequest, rateLimitAllow } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST { propertyId } — count a public listing view (guest pages).
 * Clients should still dedupe per session/tab.
 */
export async function POST(req: Request) {
  // Internal browsers and team accounts do not count as listing views.
  if (hasInternalCookieHeader(req.headers.get("cookie"))) {
    return NextResponse.json({ ok: true, skipped: "internal" }, { status: 200 });
  }
  const ip = incomingIpFromRequest(req);
  if (!rateLimitAllow(`listing-views:${ip}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { propertyId?: string };
  try {
    body = (await req.json()) as { propertyId?: string };
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const propertyId = body.propertyId?.trim();
  if (!propertyId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      published: true,
      host: { active: true },
    },
    select: { id: true, slug: true },
  });
  if (!property) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (await actorIsInternal()) {
    return NextResponse.json({ ok: true, skipped: "internal" }, { status: 200 });
  }

  try {
    await recordPropertyView(property.id);
    trackAnalyticsEvent({
      name: "listing_view",
      listingId: property.id,
      path: `/marketplace/properties/${property.slug}`,
    });
  } catch (e) {
    console.error("[listing-views]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
