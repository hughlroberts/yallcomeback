/**
 * Listing filters beyond where / when / who: bedrooms, nightly price and
 * amenities. Shared by the marketplace page, /api/marketplace/stays and the
 * agent API so results, counts and every search link keep the same filters.
 */

export type ListingFilters = {
  bedrooms?: number;
  minNightly?: number;
  maxNightly?: number;
  /** Amenity ids or labels, lower-case; a listing must match all of them. */
  amenities?: string[];
};

function num(raw: string | null | undefined): number | undefined {
  if (raw == null || !raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeListingFilters(raw: {
  bedrooms?: number | null;
  minNightly?: number | null;
  maxNightly?: number | null;
  amenities?: readonly string[] | string | null;
}): ListingFilters {
  const out: ListingFilters = {};
  if (
    raw.bedrooms != null &&
    Number.isFinite(raw.bedrooms) &&
    raw.bedrooms > 0
  ) {
    out.bedrooms = Math.floor(raw.bedrooms);
  }
  if (
    raw.minNightly != null &&
    Number.isFinite(raw.minNightly) &&
    raw.minNightly > 0
  ) {
    out.minNightly = raw.minNightly;
  }
  if (
    raw.maxNightly != null &&
    Number.isFinite(raw.maxNightly) &&
    raw.maxNightly > 0
  ) {
    out.maxNightly = raw.maxNightly;
  }
  const list =
    typeof raw.amenities === "string"
      ? raw.amenities.split(",")
      : (raw.amenities ?? []);
  const amenities = Array.from(
    new Set(list.map((a) => a.trim().toLowerCase()).filter(Boolean)),
  );
  if (amenities.length > 0) out.amenities = amenities;
  return out;
}

/** Read filters from query params (amenities also accepts ?amenity=). */
export function listingFiltersFromParams(
  get: (key: string) => string | null | undefined,
): ListingFilters {
  return normalizeListingFilters({
    bedrooms: num(get("bedrooms")),
    minNightly: num(get("minNightly")),
    maxNightly: num(get("maxNightly")),
    amenities: get("amenities") || get("amenity") || null,
  });
}

export function hasListingFilters(f: ListingFilters | undefined): boolean {
  return Boolean(
    f &&
    (f.bedrooms ||
      f.minNightly != null ||
      f.maxNightly != null ||
      f.amenities?.length),
  );
}

function parseAmenityJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (Array.isArray(j)) return j.map((a) => String(a).toLowerCase());
  } catch {
    /* ignore */
  }
  return [];
}

export function listingMatchesFilters(
  p: { bedrooms: number; baseNightlyRate: number; amenities: string | null },
  f: ListingFilters,
): boolean {
  if (f.bedrooms && p.bedrooms < f.bedrooms) return false;
  if (f.minNightly != null && p.baseNightlyRate < f.minNightly) return false;
  if (f.maxNightly != null && p.baseNightlyRate > f.maxNightly) return false;
  if (f.amenities?.length) {
    const have = parseAmenityJson(p.amenities);
    return f.amenities.every(
      (w) =>
        have.includes(w) || have.some((h) => h.includes(w) || w.includes(h)),
    );
  }
  return true;
}

/** Add the active filters to a search URL (stable order, only those set). */
export function appendListingFilterParams(
  sp: URLSearchParams,
  f: ListingFilters | undefined,
) {
  if (!f) return;
  if (f.bedrooms) sp.set("bedrooms", String(f.bedrooms));
  if (f.minNightly != null) sp.set("minNightly", String(f.minNightly));
  if (f.maxNightly != null) sp.set("maxNightly", String(f.maxNightly));
  if (f.amenities?.length) sp.set("amenities", f.amenities.join(","));
}

/** Short labels for the results summary line. */
export function listingFilterLabels(f: ListingFilters): string[] {
  const out: string[] = [];
  if (f.bedrooms)
    out.push(`${f.bedrooms}+ bedroom${f.bedrooms === 1 ? "" : "s"}`);
  if (f.minNightly != null && f.maxNightly != null)
    out.push(`$${f.minNightly}–$${f.maxNightly}/night`);
  else if (f.minNightly != null) out.push(`from $${f.minNightly}/night`);
  else if (f.maxNightly != null) out.push(`up to $${f.maxNightly}/night`);
  if (f.amenities?.length)
    out.push(f.amenities.map((a) => a.replace(/_/g, " ")).join(", "));
  return out;
}
