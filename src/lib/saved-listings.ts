/**
 * Guest wishlist / hearted stays (browser localStorage).
 */

export const SAVED_LISTINGS_KEY = "staylocal:savedListings:v1";
export const MAX_SAVED_LISTINGS = 60;

export type SavedListing = {
  id: string;
  slug: string;
  hostSlug: string;
  title: string;
  city: string | null;
  region: string | null;
  baseNightlyRate: number;
  bedrooms: number;
  maxGuests: number;
  imageUrl: string | null;
  savedAt: number;
};

export function listingHref(s: Pick<SavedListing, "slug" | "hostSlug">) {
  return `/marketplace/properties/${s.slug}?host=${s.hostSlug}`;
}
