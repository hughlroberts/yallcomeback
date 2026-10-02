export type ListingVisibility = "off" | "website" | "both";

export function visibilityFromFlags(
  published: boolean,
  listOnMarketplace: boolean,
): ListingVisibility {
  if (!published) return "off";
  return listOnMarketplace ? "both" : "website";
}

export function flagsFromVisibility(visibility: string): {
  published: boolean;
  listOnMarketplace: boolean;
} {
  if (visibility === "both") {
    return { published: true, listOnMarketplace: true };
  }
  if (visibility === "website") {
    return { published: true, listOnMarketplace: false };
  }
  return { published: false, listOnMarketplace: false };
}

export function visibilityLabel(visibility: ListingVisibility): string {
  if (visibility === "both") return "On · website + Find a Place";
  if (visibility === "website") return "On · website only";
  return "Off — not taking bookings";
}

export function visibilityBadgeClass(visibility: ListingVisibility): string {
  if (visibility === "off") {
    return "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-100";
  }
  if (visibility === "website") {
    return "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-100";
  }
  return "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-100";
}
