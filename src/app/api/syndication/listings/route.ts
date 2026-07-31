import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  hostFromSyndicationKey,
  marketplacePublicUrl,
  upsertSyndicatedListing,
  type SyndicationListingInput,
} from "@/lib/syndication";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Remote open-source / self-host → central marketplace.
 *
 * Auth: Authorization: Bearer <host.syndicationApiKey>
 *
 * POST body: SyndicationListingInput (slug, title, baseNightlyRate, …)
 * GET: list this host’s syndicated (all) properties + marketplace URLs
 */
export async function GET(req: Request) {
  const host = await hostFromSyndicationKey(req.headers.get("authorization"));
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    new URL(req.url).origin;

  const properties = await prisma.property.findMany({
    where: { hostId: host.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      listOnMarketplace: true,
      baseNightlyRate: true,
      city: true,
      region: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    host: {
      id: host.id,
      slug: host.slug,
      name: host.name,
      listOnMarketplace: host.listOnMarketplace,
      hostingMode: host.hostingMode,
    },
    properties: properties.map((p) => ({
      ...p,
      marketplaceUrl:
        p.published && p.listOnMarketplace && host.listOnMarketplace
          ? marketplacePublicUrl(origin, p.slug, host.slug)
          : null,
    })),
  });
}

export async function POST(req: Request) {
  const host = await hostFromSyndicationKey(req.headers.get("authorization"));
  if (!host) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SyndicationListingInput;
  try {
    body = (await req.json()) as SyndicationListingInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const property = await upsertSyndicatedListing(host, body);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      process.env.AUTH_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;

    const onMarketplace =
      property.published &&
      property.listOnMarketplace &&
      host.listOnMarketplace;

    return NextResponse.json({
      ok: true,
      property: {
        id: property.id,
        slug: property.slug,
        title: property.title,
        published: property.published,
        listOnMarketplace: property.listOnMarketplace,
        marketplaceUrl: onMarketplace
          ? marketplacePublicUrl(origin, property.slug, host.slug)
          : null,
      },
      note: !host.listOnMarketplace
        ? "Host has marketplace off — listing saved but will not appear until host listOnMarketplace is enabled."
        : !property.listOnMarketplace
          ? "Listing marketplace flag is off."
          : !property.published
            ? "Listing is draft (published=false)."
            : "Listing is live on the marketplace when discovery includes it.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upsert failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
