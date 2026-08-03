import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordPropertyView } from "@/lib/listing-insights";

export const dynamic = "force-dynamic";

/**
 * POST { propertyId } — count a public listing view (guest pages).
 * Light rate limit via no-store; clients should dedupe per session/tab.
 */
export async function POST(req: Request) {
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
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await recordPropertyView(property.id);
  } catch (e) {
    console.error("[listing-views]", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
