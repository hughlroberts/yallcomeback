/**
 * Guest browse continuity (Airbnb-style): recent searches + recently viewed.
 * Storage lives in the browser (localStorage); helpers here are shared pure logic.
 */

export const RECENT_VIEWS_KEY = "staylocal:recentViews:v1";
export const RECENT_SEARCHES_KEY = "staylocal:recentSearches:v1";
export const MAX_RECENT_VIEWS = 18;
export const MAX_RECENT_SEARCHES = 8;

export type RecentView = {
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
  viewedAt: number;
};

export type RecentSearch = {
  where?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: number;
  /** How many stays matched when they searched (for banner) */
  resultCount?: number;
  searchedAt: number;
};

export function searchIsMeaningful(s: Partial<RecentSearch>): boolean {
  return Boolean(
    s.where?.trim() ||
      s.checkIn?.trim() ||
      s.checkOut?.trim() ||
      (s.guests != null && s.guests > 0) ||
      (s.pets != null && s.pets > 0),
  );
}

export function searchDedupeKey(s: RecentSearch): string {
  return [
    s.where?.trim().toLowerCase() ?? "",
    s.checkIn ?? "",
    s.checkOut ?? "",
    s.guests ?? "",
    s.pets ?? "",
  ].join("|");
}

/** Marketplace URL for a saved search. */
export function searchToMarketplaceHref(s: RecentSearch): string {
  const params = new URLSearchParams();
  params.set("tab", "stays");
  if (s.where?.trim()) params.set("where", s.where.trim());
  if (s.checkIn) params.set("checkIn", s.checkIn);
  if (s.checkOut) params.set("checkOut", s.checkOut);
  if (s.guests && s.guests > 0) params.set("guests", String(s.guests));
  if (s.pets && s.pets > 0) params.set("pets", String(s.pets));
  return `/marketplace?${params.toString()}`;
}

function formatShortDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Human line for continue-search banner / section titles. */
export function formatSearchLabel(s: RecentSearch): string {
  const parts: string[] = [];
  if (s.where?.trim()) parts.push(s.where.trim());
  if (s.checkIn && s.checkOut) {
    parts.push(`${formatShortDate(s.checkIn)} – ${formatShortDate(s.checkOut)}`);
  } else if (s.checkIn) {
    parts.push(`from ${formatShortDate(s.checkIn)}`);
  }
  if (s.guests && s.guests > 0) {
    parts.push(`${s.guests} guest${s.guests === 1 ? "" : "s"}`);
  }
  if (s.pets && s.pets > 0) {
    parts.push(`${s.pets} pet${s.pets === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "homes";
}

export function formatContinueSearchText(s: RecentSearch): string {
  const where = s.where?.trim();
  const near = where ? `near ${where}` : "anywhere";
  const bits: string[] = [`Continue searching for homes ${near}`];
  if (s.checkIn && s.checkOut) {
    bits.push(
      `${formatShortDate(s.checkIn)} – ${formatShortDate(s.checkOut)}`,
    );
  }
  if (s.resultCount != null && s.resultCount > 0) {
    bits.push(`(${s.resultCount})`);
  }
  if (s.guests && s.guests > 0) {
    bits.push(`${s.guests} guest${s.guests === 1 ? "" : "s"}`);
  }
  return bits.join(" ");
}

/** Place label for “Stay in …” from last search or last view. */
export function placeFromHistory(
  search: RecentSearch | null,
  views: RecentView[],
): string | null {
  if (search?.where?.trim()) return search.where.trim();
  const v = views[0];
  if (!v) return null;
  return v.city?.trim() || v.region?.trim() || null;
}
