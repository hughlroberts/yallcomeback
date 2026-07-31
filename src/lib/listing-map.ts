/**
 * Guest-facing listing map helpers (area view, privacy-aware center).
 */

export type PublicMapPoint = {
  /** Center used for the public map (may be fuzzed) */
  lat: number;
  lng: number;
  /** True when host allows a tight pin on the true spot */
  precise: boolean;
  /** Zoom-ish delta for OSM bbox */
  bboxDelta: number;
};

/**
 * Public map center. When the host hides exact location, fuzz coords and
 * use a wider view so the pin represents an area, not the street address.
 */
export function publicMapPoint(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  showPreciseLocation: boolean,
): PublicMapPoint | null {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  if (showPreciseLocation) {
    return {
      lat: latitude,
      lng: longitude,
      precise: true,
      bboxDelta: 0.012,
    };
  }

  // ~0.5–1 km fuzz so the pin is not the exact home
  const lat = Math.round(latitude * 80) / 80;
  const lng = Math.round(longitude * 80) / 80;
  return {
    lat,
    lng,
    precise: false,
    bboxDelta: 0.045,
  };
}

/** OpenStreetMap embed URL (no marker - we draw a custom house pin). */
export function listingMapEmbedUrl(point: PublicMapPoint): string {
  const { lat, lng, bboxDelta: delta } = point;
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta * 0.65;
  const bottom = lat - delta * 0.65;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik`;
}

/** External “open in maps” link (still uses public / fuzzed center). */
export function listingMapExternalUrl(point: PublicMapPoint): string {
  return `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=${point.precise ? 15 : 12}/${point.lat}/${point.lng}`;
}

/** City · region · country line under the heading. */
export function formatListingPlaceLine(opts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string | null {
  const parts = [opts.city, opts.region, opts.country]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(", ");
}
