import { listingTypeLabel } from "@/lib/listing-types";
import { HOST_TIME_ZONE } from "@/lib/host-today";

/** Placeholder title the setup wizard gives a new draft (step 1). */
export const UNTITLED_LISTING_TITLE = "Untitled listing";

export function isUntitledListing(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  return !t || t === UNTITLED_LISTING_TITLE;
}

export type ListingTitleSource = {
  title: string;
  propertyType?: string | null;
  city?: string | null;
  region?: string | null;
  createdAt?: Date | string | null;
};

/**
 * Name to show where listings are listed. A titled listing shows its title.
 * An untitled draft gets a descriptive label from what is known, e.g.
 * "Draft · Cabin · Austin, TX" or "Draft · House · created Nov 2".
 */
export function listingDisplayTitle(p: ListingTitleSource): string {
  if (!isUntitledListing(p.title)) return p.title.trim();
  const parts = ["Draft"];
  if (p.propertyType) parts.push(listingTypeLabel(p.propertyType));
  const place = [p.city, p.region]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (place) {
    parts.push(place);
  } else if (p.createdAt) {
    const d = new Date(p.createdAt);
    if (!Number.isNaN(d.getTime())) {
      const day = new Intl.DateTimeFormat("en-US", {
        timeZone: HOST_TIME_ZONE,
        month: "short",
        day: "numeric",
      }).format(d);
      parts.push(`created ${day}`);
    }
  }
  return parts.join(" · ");
}
