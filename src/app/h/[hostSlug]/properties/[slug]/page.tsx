import { notFound, redirect } from "next/navigation";
import ListingPage, { generateMetadata as listingMetadata } from "@/app/marketplace/properties/[slug]/page";
import { getHostBySlugAny, getHostForGuestSite } from "@/lib/host";
import {
  brandedSiteGuestFallbackUrl,
  planIncludesBrandedSiteForHost,
} from "@/lib/branded-site-gate";
import { prisma } from "@/lib/db";
import { findHiddenBrandListing, pausedListingAccess } from "@/lib/brand-visibility";
import { ListingUnavailable } from "@/components/listing-unavailable";

export const dynamic = "force-dynamic";
export const generateMetadata = listingMetadata;

export default async function HostPropertyPage({ params, searchParams }: {
  params: Promise<{ hostSlug: string; slug: string }>;
  searchParams?: Promise<{ preview?: string; checkIn?: string; checkOut?: string; guests?: string; pets?: string }>;
}) {
  const { hostSlug, slug } = await params;
  const sp = (await searchParams) ?? {};
  const host = await getHostForGuestSite(hostSlug);
  if (!host) {
    if (await findHiddenBrandListing(slug, hostSlug)) return <ListingUnavailable hostSlug={hostSlug} />;
    const any = await getHostBySlugAny(hostSlug);
    if (any?.active && !(await planIncludesBrandedSiteForHost(any))) {
      redirect(brandedSiteGuestFallbackUrl(hostSlug, `/properties/${slug}`, sp));
    }
    notFound();
  }
  const property = await prisma.property.findFirst({
    where: { hostId: host.id, slug, published: true, archivedAt: null },
    select: { id: true },
  });
  if (!property) {
    const paused = await pausedListingAccess(slug, host.slug, sp.preview);
    if (!paused) notFound();
    if (paused.kind === "unavailable") return <ListingUnavailable hostSlug={hostSlug} />;
  }
  return <ListingPage params={params} searchParams={Promise.resolve(sp)} />;
}
