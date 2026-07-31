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
    .replace(/&#x27;/g, "'")
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
  // Prefer values near listing context when possible
  const re = new RegExp(`"${key}"\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 10_000) return n;
  }
  return null;
}

/** schema.org JSON-LD blocks (VacationRental, Product, etc.) */
function parseLdJsonBlocks(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const raw = m[1]!.trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") out.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === "object") {
        out.push(parsed as Record<string, unknown>);
      }
    } catch {
      /* skip broken ld+json */
    }
  }
  return out;
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
    let url = decodeHtml(u).replace(/\\u002F/g, "/").split("?")[0]!;
    if (!url.startsWith("http")) return;
    if (source === "airbnb") {
      if (
        url.includes("/user/") ||
        url.includes("PlatformAssets") ||
        url.includes("AirbnbPlatformAssets") ||
        url.includes("/profile") ||
        url.includes("avatar")
      ) {
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

  // Airbnb listing photos (UUID-style paths)
  for (const m of html.matchAll(
    /https:\/\/a0\.muscache\.com\/im\/pictures\/(?:miso\/Hosting-\d+\/original\/)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|jpeg|png)/gi,
  )) {
    push(m[0]!);
  }

  // Broader Airbnb pictures path, still excluding platform assets
  for (const m of html.matchAll(
    /https:\/\/a0\.muscache\.com\/im\/pictures\/(?!AirbnbPlatformAssets)[^"'\\s?]+\.(?:jpg|jpeg|png)/gi,
  )) {
    push(m[0]!);
  }

  // baseUrl fields in niobe JSON
  for (const m of html.matchAll(
    /"baseUrl"\s*:\s*"(https:\/\/a0\.muscache\.com\/im\/pictures\/[^"]+)"/gi,
  )) {
    push(m[1]!);
  }

  // VRBO / Expedia CDN common patterns
  for (const m of html.matchAll(
    /https:\/\/[^"'\\?]*(?:media\.expedia|images\.trvl-media|vrbo)[^"'\\?]+\.(?:jpg|jpeg|png|webp)/gi,
  )) {
    push(m[0]!);
  }

  // Generic og-like absolute images in JSON
  for (const m of html.matchAll(
    /"(?:uri|url|large|xl_image)"\s*:\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png)[^"]*)"/gi,
  )) {
    push(m[1]!);
  }

  // Prefer longer UUID photo lists (listing gallery) over OG single
  return out.slice(0, 40);
}

const AMENITY_JUNK =
  /translated|where you|more information|guest favorite|show all|learn more|accessibility features|guest entrance|^share$|^save$|^saved$|check-in after|checkout before|self check-in|guests maximum|quiet hours|no parties|no smoking|what.?s the bathroom|where you.?ll sleep|report this|host details|languages|select dates|additional rules|additional requests|gather used|throw trash|turn things off|what this place offers|^adults$|^children$|^infants$|^pets$|nearby lake|carbon monoxide|smoke alarm|disabled parking|houston|austin|dallas|show more|read more|see all/i;

function extractAmenities(html: string, description: string): string[] {
  const found = new Set<string>();
  // Keyword scan (description + a slice of page HTML)
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
    "Fireplace",
    "Patio",
    "Balcony",
    "Grill",
    "Dishwasher",
  ];
  const blob = `${html.slice(0, 200_000)}\n${description}`.toLowerCase();
  for (const k of keywords) {
    if (blob.includes(k.toLowerCase())) found.add(k);
  }
  // JSON amenity titles near available:true (Airbnb amenity list)
  for (const m of html.matchAll(
    /"title"\s*:\s*"([^"]{3,48})"\s*,\s*"available"\s*:\s*true/g,
  )) {
    const t = decodeHtml(m[1]!);
    if (
      !AMENITY_JUNK.test(t) &&
      !t.includes("http") &&
      !/^\d+\s*(bed|bath|guest)/i.test(t)
    ) {
      found.add(t);
    }
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

  const ldBlocks = parseLdJsonBlocks(html);
  const vacation = ldBlocks.find((b) => {
    const t = b["@type"];
    if (typeof t === "string") {
      return /VacationRental|LodgingBusiness|Product|Apartment|House/i.test(t);
    }
    if (Array.isArray(t)) {
      return t.some((x) =>
        typeof x === "string" &&
        /VacationRental|LodgingBusiness|Product|Apartment|House/i.test(x),
      );
    }
    return false;
  });

  const ogTitle = metaContent(html, "og:title");
  const ogDesc = metaContent(html, "og:description");

  const ldName =
    vacation && typeof vacation.name === "string" ? vacation.name : null;
  const ldDesc =
    vacation && typeof vacation.description === "string"
      ? vacation.description
      : null;

  const listingTitle = (
    jsonStringField(html, "listingTitle") ||
    ldName ||
    // Avoid greedy "name" which can pick UI chrome — only use short ones
    (() => {
      const n = jsonStringField(html, "name");
      if (n && n.length >= 8 && n.length <= 100 && !AMENITY_JUNK.test(n)) {
        return n;
      }
      return null;
    })() ||
    ogDesc ||
    ogTitle ||
    "Imported listing"
  ).replace(/\s+/g, " ").trim();

  let description =
    ldDesc ||
    jsonStringField(html, "description") ||
    jsonStringField(html, "sectionedDescription") ||
    ogDesc ||
    "";

  // Airbnb sometimes duplicates short description; prefer longer
  const longDesc = jsonStringField(html, "htmlDescription");
  if (longDesc && longDesc.length > description.length) {
    description = longDesc.replace(/<[^>]+>/g, "\n").replace(/\n{3,}/g, "\n\n");
  }
  description = description.replace(/\s+\n/g, "\n").trim();

  const city =
    jsonStringField(html, "localizedCityName") ||
    jsonStringField(html, "localizedLocation") ||
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
      const parts = loc[1]!.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts[1]) region = parts[1];
      if (parts[2]) country = parts[2];
    }
  }

  // Address from schema.org
  if (vacation && vacation.address && typeof vacation.address === "object") {
    const addr = vacation.address as Record<string, unknown>;
    if (!city && typeof addr.addressLocality === "string") {
      /* handled below via fallback */
    }
    if (typeof addr.addressRegion === "string" && !region) {
      region = addr.addressRegion;
    }
    if (typeof addr.addressCountry === "string") {
      country =
        typeof addr.addressCountry === "string" ? addr.addressCountry : country;
    }
  }

  const counts = parseCountsFromOgTitle(ogTitle);
  const maxGuests =
    jsonNumberField(html, "personCapacity") ||
    jsonNumberField(html, "person_capacity") ||
    4;

  const bedrooms =
    counts.bedrooms ??
    jsonNumberField(html, "bedroomCount") ??
    jsonNumberField(html, "bedrooms") ??
    1;
  const beds =
    counts.beds ?? jsonNumberField(html, "bedCount") ?? bedrooms;
  const bathrooms =
    counts.bathrooms ??
    jsonNumberField(html, "bathroomCount") ??
    jsonNumberField(html, "bathrooms") ??
    1;

  const roomType =
    jsonStringField(html, "roomAndPropertyType") ||
    jsonStringField(html, "propertyTypeGrouping") ||
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
    tagline =
      description
        .split("\n")
        .map((l) => l.trim())
        .find(Boolean)
        ?.slice(0, 120) ?? null;
  }

  const star = jsonNumberField(html, "starRating");
  if (star && star <= 5) notes.push(`Source rating: ${star}`);

  // Clean title if we accidentally picked full page title
  let title = listingTitle.slice(0, 120);
  title = title
    .replace(/\s*[-–]\s*Airbnb.*$/i, "")
    .replace(/\s*·\s*★.*$/i, "")
    .replace(/\s*·\s*\d+\s*bedrooms?.*$/i, "")
    .trim();

  return {
    source,
    sourceUrl,
    sourceId,
    title: title || "Imported listing",
    tagline,
    description: description || title,
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
