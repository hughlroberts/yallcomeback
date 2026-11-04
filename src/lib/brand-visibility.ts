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

/**
 * T58: a paused listing (published=false, not archived) on an active host.
 * Guests see the "not available" page; the brand's own host/admin get a
 * preview with a "Paused, not visible to guests" banner.
 */
export async function findPausedListing(
  slug: string,
  hostSlug?: string | null,
): Promise<{ id: string; hostId: string; hostSlug: string } | null> {
  const row = await prisma.property.findFirst({
    where: {
      slug,
      published: false,
      archivedAt: null,
      host: { active: true, ...(hostSlug ? { slug: hostSlug } : {}) },
    },
    select: { id: true, hostId: true, host: { select: { slug: true } } },
  });
  return row ? { id: row.id, hostId: row.hostId, hostSlug: row.host.slug } : null;
}

/** T58: what a direct link to a paused listing shows this viewer. */
export async function pausedListingAccess(
  slug: string,
  hostSlug?: string | null,
  previewToken?: string | null,
): Promise<{ kind: "preview"; id: string; hostSlug: string } | { kind: "unavailable" } | null> {
  const paused = await findPausedListing(slug, hostSlug);
  if (!paused) return null;
  // Signed token from the admin page works without the session cookie.
  const { verifyListingPreviewToken } = await import("@/lib/listing-preview-token");
  if (previewToken && verifyListingPreviewToken(previewToken, paused.id)) {
    return { kind: "preview", id: paused.id, hostSlug: paused.hostSlug };
  }
  if (!(await canPreviewBrand(paused.hostId))) return { kind: "unavailable" };
  return { kind: "preview", id: paused.id, hostSlug: paused.hostSlug };
}

export const PAUSED_PREVIEW_BANNER = "Paused, not visible to guests";

/** T59: browser title for the owner's paused preview. */
export function pausedPreviewTitle(name: string): string {
  return `${name} · Paused preview`;
}
