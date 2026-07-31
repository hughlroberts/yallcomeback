import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hostFromSyndicationKey } from "@/lib/syndication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Unpublish / remove marketplace visibility for a syndicated listing.
 * DELETE /api/syndication/listings/:slug
 * Body optional: { "delete": true } to hard-delete, else unpublish + delist.
 */
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const host = await hostFromSyndicationKey(req.headers.get("authorization"));
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug: raw } = await ctx.params;
  const slug = decodeURIComponent(raw).trim().toLowerCase();
  const property = await prisma.property.findUnique({
    where: { hostId_slug: { hostId: host.id, slug } },
  });
  if (!property) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let hardDelete = false;
  try {
    const body = (await req.json()) as { delete?: boolean };
    hardDelete = body?.delete === true;
  } catch {
    hardDelete = false;
  }

  if (hardDelete) {
    await prisma.property.delete({ where: { id: property.id } });
    return NextResponse.json({ ok: true, deleted: true, slug });
  }

  await prisma.property.update({
    where: { id: property.id },
    data: { published: false, listOnMarketplace: false },
  });
  return NextResponse.json({
    ok: true,
    deleted: false,
    unpublished: true,
    slug,
  });
}
