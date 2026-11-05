import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostForGuestSite } from "@/lib/host";
import { ListingUnavailable } from "@/components/listing-unavailable";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import {
  LISTING_UNAVAILABLE_TITLE,
  findHiddenBrandListing,
  pausedListingAccess,
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
function listingRedirectQuery(
  hostSlug: string,
  sp: {
    preview?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
  },
  extras: Record<string, string> = {},
) {
  const q = new URLSearchParams({ host: hostSlug, ...extras });
  if (sp.preview) q.set("preview", sp.preview);
  if (sp.checkIn) q.set("checkIn", sp.checkIn);
  if (sp.checkOut) q.set("checkOut", sp.checkOut);
  if (sp.guests) q.set("guests", sp.guests);
  if (sp.pets) q.set("pets", sp.pets);
  return q.toString();
}

export default async function HostPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ hostSlug: string; slug: string }>;
  searchParams?: Promise<{
    preview?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
  }>;
}) {
  const { hostSlug, slug } = await params;
  const sp = (await searchParams) ?? {};
  const previewToken = sp.preview;
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
  if (!property) {
    // T58: paused. Host/admin preview on the listing page; guests "not available".
    const paused = await pausedListingAccess(slug, host.slug, previewToken);
    if (!paused) notFound();
    if (paused.kind === "unavailable") return <ListingUnavailable />;
    redirect(
      `/marketplace/properties/${encodeURIComponent(slug)}?${listingRedirectQuery(host.slug, sp)}`,
    );
  }

  // Preserve host brand context for chrome + attribution, and keep trip
  // params so the listing widget prefills checkIn/checkOut/guests (E1104-C6).
  redirect(
    `/marketplace/properties/${property.slug}?${listingRedirectQuery(host.slug, sp, { via: "host_site" })}#reserve`,
  );
}
