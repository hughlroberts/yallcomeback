import type { ImportSource, ImportedListingDraft } from "./types";

function metaContent(html: string, prop: string): string | null {
  const re1 = new RegExp(
    `property=["']${prop}["']\\s+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `content=["']([^"']+)["']\\s+property=["']${prop}["']`,
    "i",
  );
  const m = html.match(re1) || html.match(re2);
  if (!m) return null;
  return decodeHtml(m[1]!);
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function jsonStringField(html: string, key: string): string | null {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "g");
  let best: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const v = JSON.parse(`"${m[1]}"`) as string;
      if (!v || v === "null") continue;
      if (!best || v.length > best.length) best = v;
    } catch {
      /* skip */
    }
  }
  return best;
}

function jsonNumberField(html: string, key: string): number | null {
  const re = new RegExp(`"${key}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`);
  const m = html.match(re);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseCountsFromOgTitle(title: string | null): {
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
} {
  if (!title) return {};
  const bedrooms = title.match(/(\d+)\s*bedrooms?\b/i)?.[1];
  // Strip "N bedroom(s)" so "beds" is not confused with "bedrooms"
  const rest = title.replace(/\d+\s*bedrooms?\b/gi, " ");
  const beds = rest.match(/(\d+)\s*beds?\b/i)?.[1];
  const bathrooms = title.match(/(\d+(?:\.\d+)?)\s*baths?\b/i)?.[1];
  return {
    bedrooms: bedrooms ? Number(bedrooms) : undefined,
    beds: beds ? Number(beds) : undefined,
    bathrooms: bathrooms ? Number(bathrooms) : undefined,
  };
}

function extractImageUrls(html: string, source: ImportSource): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (u: string) => {
    let url = u.split("?")[0]!;
    if (source === "airbnb") {
      // Prefer full-size originals when we only have UUID form
      if (
        url.includes("muscache.com/im/pictures/") &&
        !url.includes("PlatformAssets") &&
        !url.includes("/user/")
      ) {
        // bump quality via query when re-downloading
      } else if (url.includes("/user/") || url.includes("PlatformAssets")) {
        return;
      }
    }
    if (seen.has(url)) return;
    // skip tiny icons
    if (/\.(svg|gif|ico)$/i.test(url)) return;
    if (url.includes("favicon") || url.includes("icon")) return;
    seen.add(url);
    out.push(url);
  };

  const og = metaContent(html, "og:image");
  if (og) push(og);

  // Airbnb listing photos
  for (const m of html.matchAll(
    /https:\/\/a0\.muscache\.com\/im\/pictures\/(?!AirbnbPlatformAssets)[^"'\\?]+\.(?:jpg|jpeg|png)/gi,
  )) {
    push(m[0]!);
  }

  // VRBO / Expedia CDN common patterns
  for (const m of html.matchAll(
    /https:\/\/[^"'\\?]*(?:media\.expedia|images\.trvl-media|vrbo)[^"'\\?]+\.(?:jpg|jpeg|png|webp)/gi,
  )) {
    push(m[0]!);
  }

  // Generic og-like absolute images in JSON
  for (const m of html.matchAll(
    /"(?:uri|url|baseUrl|large|xl_image)"\s*:\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png)[^"]*)"/gi,
  )) {
    push(m[1]!.replace(/\\u002F/g, "/"));
  }

  return out.slice(0, 40);
}

function extractAmenities(html: string, description: string): string[] {
  const found = new Set<string>();
  // Airbnb amenity titles near available:true is brittle; use common keywords from description
  const keywords = [
    "Wifi",
    "Kitchen",
    "Washer",
    "Dryer",
    "Air conditioning",
    "Heating",
    "TV",
    "Free parking",
    "Pool",
    "Hot tub",
    "Lake view",
    "Waterfront",
    "Beach access",
    "Fire pit",
    "BBQ grill",
    "Pets allowed",
    "Workspace",
    "Gym",
    "EV charger",
    "Private dock",
    "Game room",
  ];
  const blob = `${html.slice(0, 200_000)}\n${description}`.toLowerCase();
  for (const k of keywords) {
    if (blob.includes(k.toLowerCase())) found.add(k);
  }
  // JSON amenity titles
  const junk =
    /translated|where you|more information|guest favorite|show all|learn more|accessibility features|guest entrance/i;
  for (const m of html.matchAll(
    /"title"\s*:\s*"([^"]{3,40})"\s*,\s*"subtitle"/g,
  )) {
    const t = decodeHtml(m[1]!);
    if (t.length < 40 && !t.includes("http") && !junk.test(t)) found.add(t);
  }
  return Array.from(found).slice(0, 40);
}

export function extractListingFromHtml(opts: {
  html: string;
  source: ImportSource;
  sourceUrl: string;
  sourceId: string | null;
}): ImportedListingDraft {
  const { html, source, sourceUrl, sourceId } = opts;
  const notes: string[] = [];

  const ogTitle = metaContent(html, "og:title");
  const ogDesc = metaContent(html, "og:description");
  const listingTitle =
    jsonStringField(html, "listingTitle") ||
    jsonStringField(html, "name") ||
    ogDesc ||
    ogTitle ||
    "Imported listing";

  let description =
    jsonStringField(html, "description") ||
    jsonStringField(html, "sectionedDescription") ||
    ogDesc ||
    "";

  // Airbnb sometimes duplicates short description; prefer longer
  const longDesc = jsonStringField(html, "htmlDescription");
  if (longDesc && longDesc.length > description.length) {
    description = longDesc.replace(/<[^>]+>/g, "\n").replace(/\n{3,}/g, "\n\n");
  }

  const city =
    jsonStringField(html, "localizedCityName") ||
    jsonStringField(html, "city") ||
    (ogTitle?.match(/in\s+([^,·]+)/i)?.[1]?.trim() ?? null);

  // From page title: "Log Cabin, Texas, United States"
  let region: string | null = null;
  let country: string | null = "United States";
  const pageTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  if (pageTitle) {
    const loc = decodeHtml(pageTitle).match(
      /in\s+([^·\-]+?)(?:\s*-\s*Airbnb|\s*$)/i,
    );
    if (loc) {
      const parts = loc[1]!.split(",").map((s) => s.trim());
      if (parts[0] && !city) {
        /* city already set */
      }
      if (parts[1]) region = parts[1];
      if (parts[2]) country = parts[2];
    }
  }

  const counts = parseCountsFromOgTitle(ogTitle);
  const maxGuests =
    jsonNumberField(html, "personCapacity") ||
    jsonNumberField(html, "person_capacity") ||
    4;

  const bedrooms =
    counts.bedrooms ?? jsonNumberField(html, "bedroomCount") ?? 1;
  const beds = counts.beds ?? jsonNumberField(html, "bedCount") ?? bedrooms;
  const bathrooms =
    counts.bathrooms ?? jsonNumberField(html, "bathroomCount") ?? 1;

  const roomType =
    jsonStringField(html, "roomAndPropertyType") ||
    jsonStringField(html, "propertyType") ||
    jsonStringField(html, "roomType") ||
    "house";

  let propertyType = "house";
  const rt = roomType.toLowerCase();
  if (rt.includes("cabin")) propertyType = "cabin";
  else if (rt.includes("condo") || rt.includes("apartment"))
    propertyType = "apartment";
  else if (rt.includes("guest suite") || rt.includes("suite"))
    propertyType = "guest_suite";
  else if (rt.includes("cottage")) propertyType = "cottage";
  else if (rt.includes("entire")) propertyType = "house";

  const imageUrls = extractImageUrls(html, source);
  if (imageUrls.length === 0) {
    notes.push("No photos found on the page — you can upload them after import.");
  }

  const amenities = extractAmenities(html, description);

  // Tagline: use short og description if different from title
  let tagline: string | null = null;
  if (ogDesc && ogDesc !== listingTitle && ogDesc.length < 120) {
    tagline = ogDesc;
  } else if (description) {
    tagline = description.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 120) ?? null;
  }

  const star = jsonNumberField(html, "starRating");
  if (star) notes.push(`Source rating: ${star}`);

  return {
    source,
    sourceUrl,
    sourceId,
    title: listingTitle.slice(0, 120),
    tagline,
    description: description || listingTitle,
    city: city?.replace(/\s+/g, " ").trim() || null,
    region,
    country,
    propertyType,
    bedrooms: Math.max(0, Math.round(bedrooms)),
    bathrooms: Math.max(0, bathrooms),
    beds: Math.max(1, Math.round(beds)),
    maxGuests: Math.max(1, Math.round(maxGuests)),
    baseNightlyRate: null,
    amenities,
    houseRules: null,
    imageUrls,
    rawNotes: notes,
  };
}
