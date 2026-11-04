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

/** Default and max results per search response (agent API and stays API). */
/** Largest party the search form takes (its guests input max). */
export const SEARCH_MAX_GUESTS = 50;

/** Whole guests from 1 to SEARCH_MAX_GUESTS, or undefined for none/junk. */
export function searchGuests(
  raw: string | number | null | undefined,
): number | undefined {
  const n = Math.floor(Number(raw));
  if (raw == null || raw === "" || !Number.isFinite(n) || n < 1) {
    return undefined;
  }
  return Math.min(SEARCH_MAX_GUESTS, n);
}

/**
 * What the guests box should read after blur: typed values clamped to
 * 1–SEARCH_MAX_GUESTS (decimals rounded down); empty or junk stays empty
 * ("Any").
 */
export function clampGuestsInput(raw: string): string {
  const t = raw.trim();
  if (t === "") return "";
  const n = Math.floor(Number(t));
  if (!Number.isFinite(n)) return "";
  return String(Math.min(SEARCH_MAX_GUESTS, Math.max(1, n)));
}

export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;

/**
 * Results per response from `take` (alias `limit`): default 20, max 50.
 * Missing, 0, negative or non-numeric values get the default (20).
 */
export function searchLimit(raw: string | number | null | undefined): number {
  const n = typeof raw === "number" ? raw : raw?.trim() ? Number(raw) : NaN;
  // Anything that isn't a whole number ≥ 1 (abc, 0, -3, 2.5) gets the
  // default, so odd input is treated one way instead of being truncated.
  if (!Number.isInteger(n) || n < 1) return SEARCH_DEFAULT_LIMIT;
  return Math.min(SEARCH_MAX_LIMIT, n);
}

export function searchLimitFromParams(
  get: (key: string) => string | null | undefined,
): number {
  return searchLimit(get("take") || get("limit"));
}

export type StrictSearchLimit =
  | { ok: true; take: number }
  | { ok: false; param: "take" | "limit"; error: string };

/**
 * Strict `take` / `limit` for the public agent API (/api/v1/search): missing
 * or empty gets the default (20); anything else must be a whole number from
 * 1 to 50, otherwise the caller returns 400 invalid_limit instead of quietly
 * using a different value. `take` wins when both are sent.
 */
export function strictSearchLimitFromParams(
  get: (key: string) => string | null | undefined,
): StrictSearchLimit {
  const take = get("take")?.trim();
  const param: "take" | "limit" = take ? "take" : "limit";
  const raw = take || get("limit")?.trim();
  if (!raw) return { ok: true, take: SEARCH_DEFAULT_LIMIT };
  const n = plainWholeNumber(raw);
  if (n == null || n < 1 || n > SEARCH_MAX_LIMIT) {
    return {
      ok: false,
      param,
      error: `${param} must be a whole number from 1 to ${SEARCH_MAX_LIMIT} (got "${raw.slice(0, 40)}").`,
    };
  }
  return { ok: true, take: n };
}

/**
 * A query value written as plain digits ("12"), else null. Rejects what
 * Number() would quietly accept: "2.5", "1e1", "0x10", "-5", "", "abc".
 */
export function plainWholeNumber(
  raw: string | number | null | undefined,
): number | null {
  const t = raw == null ? "" : String(raw).trim();
  if (!/^\d{1,9}$/.test(t)) return null;
  return Number(t);
}

export type PartyParams =
  | { ok: true; guests: number | undefined; pets: number | undefined }
  | {
      ok: false;
      code: "invalid_guests" | "invalid_pets";
      error: string;
    };

/**
 * Shared `guests` / `pets` parser for the public search and listing APIs
 * (/api/v1/search, /api/v1/listings/{slug}, /api/marketplace/stays).
 * Missing or empty = not sent. guests must be a whole number ≥ 1 and pets a
 * whole number ≥ 0; anything else (-5, abc, 2.5, 1e1) is a 400
 * invalid_guests / invalid_pets, so a bad value is never quietly dropped
 * or carried into bookUrl.
 */
export function partyFromParams(
  get: (key: string) => string | null | undefined,
): PartyParams {
  const g = get("guests")?.trim();
  const p = get("pets")?.trim();
  let guests: number | undefined;
  let pets: number | undefined;
  if (g) {
    const n = plainWholeNumber(g);
    if (n == null || n < 1) {
      return {
        ok: false,
        code: "invalid_guests",
        error: `guests must be a whole number of 1 or more (got "${g.slice(0, 40)}").`,
      };
    }
    guests = n;
  }
  if (p) {
    const n = plainWholeNumber(p);
    if (n == null) {
      return {
        ok: false,
        code: "invalid_pets",
        error: `pets must be a whole number of 0 or more (got "${p.slice(0, 40)}").`,
      };
    }
    pets = n;
  }
  return { ok: true, guests, pets };
}
