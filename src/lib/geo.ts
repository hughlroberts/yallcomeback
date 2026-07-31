/** Earth radius in miles (mean). */
const EARTH_MI = 3958.7613;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two WGS84 points (haversine), in miles.
 * US / Texas marketplace - miles only, not kilometers.
 */
export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** @deprecated Use haversineMiles - kept for any external callers */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return haversineMiles(lat1, lon1, lat2, lon2) * 1.609344;
}

export function hasCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Guest-facing distance label in miles (Texas / US).
 * Examples: "Nearby", "0.4 mi away", "3.2 mi away", "12 mi away"
 */
export function formatDistanceMiles(
  miles: number | null | undefined,
): string | null {
  if (miles == null || !Number.isFinite(miles)) return null;
  if (miles < 0.05) return "Nearby";
  if (miles < 10) {
    const rounded = Math.round(miles * 10) / 10;
    return `${rounded} mi away`;
  }
  return `${Math.round(miles)} mi away`;
}

/** @deprecated Use formatDistanceMiles */
export function formatDistanceKm(
  km: number | null | undefined,
): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  return formatDistanceMiles(km * 0.621371);
}

function normalizePlace(s: string | null | undefined) {
  return (s || "").trim().toLowerCase();
}

/** Fallback rank when map coords are missing (lower = closer). */
export function placeMatchScore(
  origin: { city?: string | null; region?: string | null },
  other: { city?: string | null; region?: string | null },
): number {
  const oc = normalizePlace(origin.city);
  const or = normalizePlace(origin.region);
  const c = normalizePlace(other.city);
  const r = normalizePlace(other.region);
  if (oc && c && oc === c) return 0;
  if (or && r && or === r) return 1;
  return 2;
}
