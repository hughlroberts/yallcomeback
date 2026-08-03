/**
 * Location / amenity quality for balanced comps.
 * A beachfront that sleeps 9 is not the same as inland 1–2 mi away;
 * lake + pool is not the same as lake-only.
 */

export type LocationTier =
  | "waterfront_prime" // on water / beach / private dock
  | "water_access" // lake access, beach access (not necessarily frontage)
  | "water_view" // view only
  | "inland";

export type QualitySignals = {
  tier: LocationTier;
  hasPool: boolean;
  hasHotTub: boolean;
  hasPrivateDock: boolean;
  amenityIds: string[];
  /** Keywords from title/description that reinforce tier */
  textHints: string[];
};

const WATERFRONT_IDS = new Set([
  "waterfront",
  "beach",
  "private_dock",
]);
const WATER_ACCESS_IDS = new Set(["lake", "beach"]);
const WATER_VIEW_IDS = new Set(["lake_view"]);

const WATERFRONT_TEXT =
  /\b(waterfront|beachfront|on the (beach|lake|bay)|lakefront|gulf front|oceanfront|private dock|boat slip)\b/i;
const WATER_ACCESS_TEXT =
  /\b(lake access|beach access|water access|steps to (the )?(lake|beach)|walk to (the )?(lake|beach))\b/i;
const WATER_VIEW_TEXT =
  /\b(lake view|water view|bay view|ocean view|gulf view)\b/i;
const ROW_BACK_TEXT =
  /\b(second row|2nd row|one row back|row back|across the street|off (the )?(beach|lake)|blocks? from)\b/i;
const MILES_OFF_TEXT =
  /\b(\d+(\.\d+)?\s*(mi|mile|miles)\s+(from|to|off)\b|near (but not on)|close to (the )?(lake|beach))\b/i;

export function parseAmenityIds(amenitiesJson: string | null | undefined): string[] {
  if (!amenitiesJson) return [];
  try {
    const raw = JSON.parse(amenitiesJson) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => String(x).toLowerCase().trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function extractQualitySignals(input: {
  amenitiesJson?: string | null;
  title?: string | null;
  description?: string | null;
  tagline?: string | null;
}): QualitySignals {
  const amenityIds = parseAmenityIds(input.amenitiesJson);
  const idSet = new Set(amenityIds);
  const text = [input.title, input.tagline, input.description]
    .filter(Boolean)
    .join(" ");

  const hasPool =
    idSet.has("pool") || /\b(private )?pool\b/i.test(text);
  const hasHotTub =
    idSet.has("hot_tub") || /\b(hot tub|jacuzzi)\b/i.test(text);
  const hasPrivateDock =
    idSet.has("private_dock") || /\bprivate dock|boat slip\b/i.test(text);

  const textHints: string[] = [];
  let tier: LocationTier = "inland";

  const amenityWaterfront = [...WATERFRONT_IDS].some((id) => idSet.has(id));
  const amenityAccess = [...WATER_ACCESS_IDS].some((id) => idSet.has(id));
  const amenityView = [...WATER_VIEW_IDS].some((id) => idSet.has(id));

  if (amenityWaterfront || WATERFRONT_TEXT.test(text) || hasPrivateDock) {
    tier = "waterfront_prime";
    textHints.push("waterfront/beach/dock signals");
  } else if (amenityAccess || WATER_ACCESS_TEXT.test(text)) {
    tier = "water_access";
    textHints.push("water access (not necessarily frontage)");
  } else if (amenityView || WATER_VIEW_TEXT.test(text)) {
    tier = "water_view";
    textHints.push("water view only");
  }

  // "One row back" / "X miles from beach" demotes prime → access
  if (tier === "waterfront_prime" && (ROW_BACK_TEXT.test(text) || MILES_OFF_TEXT.test(text))) {
    tier = "water_access";
    textHints.push("text suggests not true frontage (row back / miles off)");
  }

  if (hasPool) textHints.push("pool");
  if (hasHotTub) textHints.push("hot tub");

  return {
    tier,
    hasPool,
    hasHotTub,
    hasPrivateDock,
    amenityIds,
    textHints,
  };
}

export function tierRank(tier: LocationTier): number {
  switch (tier) {
    case "waterfront_prime":
      return 3;
    case "water_access":
      return 2;
    case "water_view":
      return 1;
    default:
      return 0;
  }
}

/**
 * Higher score = worse match (like distance). Used to rank peers.
 * Heavily penalize waterfront vs inland mismatches.
 */
export function peerMismatchScore(
  subject: QualitySignals,
  peer: QualitySignals,
  opts: {
    guestDelta: number;
    bedroomDelta: number;
    sameCity: boolean;
    sameRegion: boolean;
    distanceMiles: number | null;
  },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Capacity still matters
  score += opts.guestDelta * 8;
  if (opts.guestDelta > 0) {
    reasons.push(`capacity Δ${opts.guestDelta}`);
  }
  score += Math.min(3, opts.bedroomDelta) * 2;

  // Location tier — critical balance
  const tierDelta = Math.abs(tierRank(subject.tier) - tierRank(peer.tier));
  if (tierDelta >= 2) {
    score += 40; // beachfront vs inland = almost never a fair comp
    reasons.push(
      `location tier mismatch (${subject.tier} vs ${peer.tier})`,
    );
  } else if (tierDelta === 1) {
    score += 18;
    reasons.push(`adjacent location tier (${subject.tier} vs ${peer.tier})`);
  }

  // Pool premium
  if (subject.hasPool !== peer.hasPool) {
    score += 14;
    reasons.push(
      subject.hasPool
        ? "subject has pool; peer does not"
        : "peer has pool; subject does not",
    );
  }

  // Dock / true waterfront amenity
  if (subject.hasPrivateDock !== peer.hasPrivateDock) {
    score += 10;
    reasons.push("private dock mismatch");
  }

  if (subject.hasHotTub !== peer.hasHotTub) {
    score += 3;
  }

  // Geo distance when known
  if (opts.distanceMiles != null) {
    if (opts.distanceMiles <= 0.15) {
      score -= 4; // same block / very close — bonus
      reasons.push(`very close (~${opts.distanceMiles.toFixed(2)} mi)`);
    } else if (opts.distanceMiles <= 0.5) {
      score += 2;
    } else if (opts.distanceMiles <= 2) {
      score += 10;
      reasons.push(`~${opts.distanceMiles.toFixed(1)} mi away`);
    } else if (opts.distanceMiles <= 10) {
      score += 20;
      reasons.push(`~${opts.distanceMiles.toFixed(1)} mi away`);
    } else {
      score += 30;
      reasons.push(`far (~${opts.distanceMiles.toFixed(0)} mi)`);
    }
  }

  if (opts.sameCity) score -= 4;
  else if (opts.sameRegion) score -= 2;
  else score += 6;

  return { score: Math.max(0, score), reasons };
}

/** Haversine distance in miles; null if coords missing. */
export function milesBetween(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
): number | null {
  if (
    a.latitude == null ||
    a.longitude == null ||
    b.latitude == null ||
    b.longitude == null
  ) {
    return null;
  }
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Max mismatch score to keep a peer in the "fair" set. */
export const FAIR_PEER_SCORE_MAX = 22;
/** Soft set if not enough fair peers. */
export const SOFT_PEER_SCORE_MAX = 36;
