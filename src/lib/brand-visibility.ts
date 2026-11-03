import { prisma } from "@/lib/db";

/**
 * T46 (10): when a Marketplace brand's add-card grace ends, the brand is
 * hidden (marketplaceSuspendedAt is set). Its direct listing URLs, booking
 * pages and new-booking paths stop working for the public too. The brand's
 * own users and Platform admins can still preview. Payment clears
 * marketplaceSuspendedAt, so everything shows again at once.
 * Existing bookings and their confirmation pages are not affected.
 */

export const LISTING_UNAVAILABLE_TITLE = "This listing isn't available right now";

export const LISTING_UNAVAILABLE_BOOKING_ERROR =
  "This listing isn't available right now. You can't book it. Nothing was charged.";

export type BrandVisibilityFields = {
  hostingMode: string;
  marketplaceSuspendedAt: Date | null;
};

export type PreviewViewer = {
  role?: string | null;
  hostId?: string | null;
} | null;

/** True when the brand is hidden because its add-card grace ended. */
export function brandListingsHidden(
  host: BrandVisibilityFields | null | undefined,
): boolean {
  if (!host) return false;
  return host.hostingMode === "PLATFORM" && host.marketplaceSuspendedAt != null;
}

/** The brand's own users and Platform admins can preview a hidden brand. */
export function viewerCanPreviewBrand(
  viewer: PreviewViewer | undefined,
  hostId: string,
): boolean {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  return viewer.role === "HOST" && viewer.hostId != null && viewer.hostId === hostId;
}

/** Session-based preview check for server pages. */
export async function canPreviewBrand(hostId: string): Promise<boolean> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  return viewerCanPreviewBrand(session?.user ?? null, hostId);
}

/** True when a hidden brand must not be shown to this viewer. */
export async function hiddenFromViewer(
  host: (BrandVisibilityFields & { id: string }) | null | undefined,
): Promise<boolean> {
  if (!host || !brandListingsHidden(host)) return false;
  return !(await canPreviewBrand(host.id));
}

/**
 * Find a published listing that belongs to a hidden brand, so a direct
 * link can show the "not available" page instead of a 404 error page.
 */
export async function findHiddenBrandListing(
  slug: string,
  hostSlug?: string | null,
): Promise<{ id: string; hostId: string } | null> {
  return prisma.property.findFirst({
    where: {
      slug,
      published: true,
      archivedAt: null,
      host: {
        active: true,
        hostingMode: "PLATFORM",
        marketplaceSuspendedAt: { not: null },
        ...(hostSlug ? { slug: hostSlug } : {}),
      },
    },
    select: { id: true, hostId: true },
  });
}
