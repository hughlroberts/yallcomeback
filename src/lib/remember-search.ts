/**
 * “The stay I already loved” — guest memory text → tokens + party size.
 * Retrieval stays in getMarketplaceListings. No LLM required.
 */

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "with",
  "we",
  "i",
  "my",
  "our",
  "it",
  "was",
  "were",
  "had",
  "have",
  "that",
  "this",
  "from",
  "last",
  "year",
  "summer",
  "about",
  "like",
  "just",
  "really",
  "already",
  "loved",
  "love",
  "stay",
  "stayed",
  "place",
  "again",
  "there",
  "they",
  "who",
  "made",
  "good",
  "great",
  "nice",
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const SYNONYMS: Record<string, string[]> = {
  grill: ["grill", "grilling", "grilled", "bbq", "barbecue"],
  dock: ["dock", "pier"],
  lake: ["lake", "lakeside", "lakefront", "waterfront"],
  cabin: ["cabin", "cottage"],
  boat: ["boat", "pontoon"],
  fire: ["firepit", "fire", "bonfire"],
};

export type RememberParse = {
  tokens: string[];
  guests?: number;
  pets?: number;
};

function parseCount(raw: string): number | undefined {
  const n = NUMBER_WORDS[raw.toLowerCase()] ?? Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(50, Math.floor(n));
}

export function parseRememberSearch(raw: string | undefined | null): RememberParse {
  const text = (raw || "").trim().slice(0, 280);
  if (!text) return { tokens: [] };

  const lower = text.toLowerCase();

  let guests: number | undefined;
  const guestHit = lower.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:people|guests|adults|of us)\b/,
  );
  if (guestHit) guests = parseCount(guestHit[1]);

  let pets: number | undefined;
  const petHit = lower.match(
    /(\d+|one|two|three|four|five|six)\s*(?:dogs?|cats?|pets?|labs?|pups?)\b/,
  );
  if (petHit) pets = parseCount(petHit[1]);
  else if (/\b(?:dog|dogs|cat|cats|pet|pets|lab|labs|pup|pups)\b/.test(lower)) {
    pets = 1;
  }

  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const part of lower.split(/[^a-z0-9]+/)) {
    if (part.length < 3 || STOP.has(part) || NUMBER_WORDS[part]) continue;
    if (/^\d+$/.test(part)) continue;
    let expanded = SYNONYMS[part];
    if (!expanded) {
      for (const vals of Object.values(SYNONYMS)) {
        if (vals.includes(part)) {
          expanded = vals;
          break;
        }
      }
    }
    for (const t of expanded || [part]) {
      if (seen.has(t)) continue;
      seen.add(t);
      tokens.push(t);
    }
  }

  return { tokens, guests, pets };
}

export function rememberHaystack(listing: {
  title: string;
  tagline?: string | null;
  description?: string | null;
  city?: string | null;
  region?: string | null;
  propertyType?: string | null;
  amenities?: string | null;
  host?: { name?: string | null } | null;
}): string {
  let amenities = "";
  try {
    const parsed = JSON.parse(listing.amenities || "[]");
    if (Array.isArray(parsed)) amenities = parsed.join(" ");
  } catch {
    amenities = listing.amenities || "";
  }
  return [
    listing.title,
    listing.tagline,
    listing.description,
    listing.city,
    listing.region,
    listing.propertyType,
    amenities,
    listing.host?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Higher is a closer memory match. 0 = no token hit. */
export function rememberScore(haystack: string, tokens: string[]): number {
  if (!tokens.length) return 0;
  let score = 0;
  for (const t of tokens) {
    if (haystack.includes(t)) score += 1;
  }
  return score;
}
