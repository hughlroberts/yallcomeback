import { isUntitledListing } from "@/lib/listing-display-title";

/**
 * T48(3): one status label for a listing everywhere (Admin and Ops).
 * - Archived: archivedAt set
 * - Live: published (detail says where guests can book)
 * - Draft: not published and never named (setup wizard placeholder)
 * - Paused: not published otherwise (guests cannot find or book it)
 * listOnMarketplace only matters while Live; it never makes a paused or
 * draft listing look like it is on the marketplace.
 */
export type ListingStatus = "Archived" | "Live" | "Draft" | "Paused";

export type ListingStatusSource = {
  title: string;
  published: boolean;
  listOnMarketplace: boolean;
  archivedAt?: Date | string | null;
};

export function listingStatus(p: ListingStatusSource): ListingStatus {
  if (p.archivedAt) return "Archived";
  if (p.published) return "Live";
  if (isUntitledListing(p.title)) return "Draft";
  return "Paused";
}

/** Badge text, e.g. "Live · website + Find a Place", "Paused", "Draft". */
export function listingStatusLabel(p: ListingStatusSource): string {
  const s = listingStatus(p);
  if (s !== "Live") return s;
  return p.listOnMarketplace ? "Live · website + Find a Place" : "Live · website only";
}

export function listingStatusBadgeClass(p: ListingStatusSource): string {
  switch (listingStatus(p)) {
    case "Archived":
      return "bg-stone-200 text-stone-700";
    case "Draft":
      return "bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200";
    case "Paused":
      return "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-100";
    default:
      return p.listOnMarketplace
        ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100"
        : "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-100";
  }
}
