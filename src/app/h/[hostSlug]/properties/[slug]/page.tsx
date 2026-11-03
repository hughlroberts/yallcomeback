import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostForGuestSite } from "@/lib/host";
import { ListingUnavailable } from "@/components/listing-unavailable";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import {
  LISTING_UNAVAILABLE_TITLE,
  findHiddenBrandListing,
} from "@/lib/brand-visibility";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { hostSlug, slug } = await params;
  if (await getHostForGuestSite(hostSlug)) return {};
  if (!(await findHiddenBrandListing(slug, hostSlug))) return {};
  return pageMetadata({
    title: LISTING_UNAVAILABLE_TITLE,
    description: "Find another place to stay on Yall Come Back.",
    path: `/h/${encodeURIComponent(hostSlug)}/properties/${encodeURIComponent(slug)}`,
    noIndex: true,
  });
}

/**
 * Host-site property URL.
 * Booking UI lives on the shared listing page (calendar + reserve).
 * Tenant chrome still applies via x-tenant-slug on custom domains, so guests
 * stay in the host brand while completing the book flow.
 */
export default async function HostPropertyPage({
  params,
}: {
  params: Promise<{ hostSlug: string; slug: string }>;
}) {
  const { hostSlug, slug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host) {
    // Hidden brand (T46): clean "not available" page, not an error.
    if (await findHiddenBrandListing(slug, hostSlug)) return <ListingUnavailable />;
    notFound();
  }

  const property = await prisma.property.findFirst({
    where: { hostId: host.id, slug, published: true, archivedAt: null },
    select: { slug: true },
  });
  if (!property) notFound();

  // Preserve host brand context for chrome + attribution
  redirect(
    `/marketplace/properties/${property.slug}?host=${host.slug}&via=host_site#reserve`,
  );
}
