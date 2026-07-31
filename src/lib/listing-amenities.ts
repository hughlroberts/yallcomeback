/**
 * Amenity catalog + guest display grouping.
 * Stored on Property.amenities as id or free-text label strings (JSON array).
 */

export type AmenityOption = {
  id: string;
  label: string;
  description?: string;
  icon: string;
};

export type AmenityGroup = {
  id: string;
  title: string;
  options: AmenityOption[];
};

export const AMENITY_BASICS: AmenityOption[] = [
  { id: "ac", label: "Air conditioning", icon: "❄️" },
  { id: "dryer", label: "Dryer", icon: "👕" },
  {
    id: "essentials",
    label: "Essentials",
    description: "Towels, bed sheets, soap, and toilet paper",
    icon: "🧻",
  },
  { id: "heating", label: "Heating", icon: "🌡️" },
  { id: "hot_water", label: "Hot water", icon: "🚿" },
  { id: "kitchen", label: "Kitchen", icon: "🍳" },
  { id: "refrigerator", label: "Refrigerator", icon: "🧊" },
  { id: "tv", label: "TV", icon: "📺" },
  { id: "washer", label: "Washer", icon: "🫧" },
  { id: "wifi", label: "Wifi", icon: "📶" },
  { id: "dishwasher", label: "Dishwasher", icon: "🍽️" },
];

export const AMENITY_POPULAR: AmenityOption[] = [
  { id: "coffee", label: "Coffee maker", icon: "☕" },
  {
    id: "cooking_basics",
    label: "Cooking basics",
    description: "Pots and pans, oil, salt and pepper",
    icon: "🥘",
  },
  { id: "hair_dryer", label: "Hair dryer", icon: "💨" },
  { id: "hangers", label: "Hangers", icon: "👔" },
  { id: "iron", label: "Iron", icon: "🧺" },
  { id: "shampoo", label: "Shampoo", icon: "🧴" },
];

export const AMENITY_FEATURES: AmenityOption[] = [
  { id: "crib", label: "Crib", icon: "👶" },
  { id: "workspace", label: "Dedicated workspace", icon: "💻" },
  { id: "ev_charger", label: "EV charger", icon: "🔌" },
  { id: "parking", label: "Free parking on premises", icon: "🅿️" },
  { id: "disabled_parking", label: "Disabled parking spot", icon: "♿" },
  { id: "gym", label: "Gym", icon: "🏋️" },
  { id: "hot_tub", label: "Hot tub", icon: "♨️" },
  { id: "fireplace", label: "Indoor fireplace", icon: "🔥" },
  { id: "outdoor_furniture", label: "Outdoor furniture", icon: "🪑" },
  { id: "pool", label: "Pool", icon: "🏊" },
  { id: "pets", label: "Pets allowed", icon: "🐾" },
  { id: "game_room", label: "Game room", icon: "🎮" },
  { id: "bbq", label: "BBQ grill", icon: "🍖" },
  { id: "fire_pit", label: "Fire pit", icon: "🔥" },
  { id: "private_dock", label: "Private dock", icon: "⚓" },
  { id: "patio", label: "Patio", icon: "🪴" },
  { id: "balcony", label: "Balcony", icon: "🌅" },
  { id: "self_checkin", label: "Self check-in", icon: "🔑" },
];

export const AMENITY_LOCATION: AmenityOption[] = [
  { id: "beach", label: "Beach access", icon: "🏖️" },
  { id: "waterfront", label: "Waterfront", icon: "🌊" },
  { id: "lake", label: "Lake access", icon: "🛶" },
  { id: "lake_view", label: "Lake view", icon: "🏞️" },
];

export const AMENITY_SAFETY: AmenityOption[] = [
  { id: "smoke_alarm", label: "Smoke alarm", icon: "🚨" },
  { id: "co_alarm", label: "Carbon monoxide alarm", icon: "⚠️" },
  { id: "fire_extinguisher", label: "Fire extinguisher", icon: "🧯" },
  { id: "first_aid", label: "First aid kit", icon: "🩹" },
];

/** Display groups for the public listing page (similarity clusters). */
export const AMENITY_DISPLAY_GROUPS: {
  id: string;
  title: string;
  optionIds: string[];
}[] = [
  {
    id: "essentials",
    title: "Essentials",
    optionIds: [
      "wifi",
      "tv",
      "ac",
      "heating",
      "kitchen",
      "refrigerator",
      "dishwasher",
      "washer",
      "dryer",
      "essentials",
      "hot_water",
      "coffee",
      "cooking_basics",
      "hair_dryer",
      "hangers",
      "iron",
      "shampoo",
    ],
  },
  {
    id: "features",
    title: "Features",
    optionIds: [
      "game_room",
      "workspace",
      "fireplace",
      "gym",
      "crib",
      "self_checkin",
      "pets",
    ],
  },
  {
    id: "outdoor",
    title: "Outdoor & location",
    optionIds: [
      "private_dock",
      "waterfront",
      "lake",
      "lake_view",
      "beach",
      "pool",
      "hot_tub",
      "bbq",
      "fire_pit",
      "patio",
      "balcony",
      "outdoor_furniture",
      "parking",
      "disabled_parking",
      "ev_charger",
    ],
  },
  {
    id: "safety",
    title: "Safety",
    optionIds: ["smoke_alarm", "co_alarm", "fire_extinguisher", "first_aid"],
  },
];

export const AMENITY_GROUPS: AmenityGroup[] = [
  { id: "basics", title: "Basics", options: AMENITY_BASICS },
  { id: "popular", title: "Popular", options: AMENITY_POPULAR },
  { id: "features", title: "Features", options: AMENITY_FEATURES },
  { id: "location", title: "Location", options: AMENITY_LOCATION },
  { id: "safety", title: "Safety", options: AMENITY_SAFETY },
];

export const ALL_AMENITY_OPTIONS = AMENITY_GROUPS.flatMap((g) => g.options);

export function amenityLabelById(id: string): string | undefined {
  return ALL_AMENITY_OPTIONS.find((a) => a.id === id)?.label;
}

/** Map stored labels (or ids) back to option ids for the wizard. */
export function selectedAmenityIds(stored: string[]): string[] {
  const ids = new Set<string>();
  for (const raw of stored) {
    const value = raw.trim();
    if (!value) continue;
    const byId = ALL_AMENITY_OPTIONS.find((a) => a.id === value);
    if (byId) {
      ids.add(byId.id);
      continue;
    }
    const byLabel = ALL_AMENITY_OPTIONS.find(
      (a) => a.label.toLowerCase() === value.toLowerCase(),
    );
    if (byLabel) ids.add(byLabel.id);
  }
  return [...ids];
}

/**
 * UI chrome / house-rules / check-in lines that should never appear as amenities.
 * (Check-in/out live under Things to know.)
 */
const AMENITY_JUNK =
  /^(share|save|saved|select dates|adults|children|infants|pets|show all|show more|read more|see all|what this place offers|additional rules|additional requests|gather used towels|throw trash away|turn things off|report this|host details|languages|quiet hours|no parties|no parties or events|no smoking|9 guests maximum|\d+\s*guests?\s*maximum)$/i;

/** Check-in/out *times* only — self check-in lockbox can stay as a feature. */
const CHECKIN_OUT_TIMES =
  /check[- ]?in\s+after|check[- ]?out\s+before|checkout\s+before|check[- ]?in\s+\d|check[- ]?out\s+\d/i;

/** Known free-text → catalog id (import + cleanup). */
const ALIAS_TO_ID: [RegExp, string][] = [
  [/^tv\b/i, "tv"],
  [/^wi-?fi$/i, "wifi"],
  [/^air\s*conditioning$/i, "ac"],
  [/^kitchen$/i, "kitchen"],
  [/^washer$/i, "washer"],
  [/^dryer$/i, "dryer"],
  [/^heating$/i, "heating"],
  [/^pets?\s*allowed$/i, "pets"],
  [/^private\s*dock$/i, "private_dock"],
  [/^game\s*room$/i, "game_room"],
  [/^disabled\s*parking/i, "disabled_parking"],
  [/^free\s*parking/i, "parking"],
  [/^smoke\s*alarm/i, "smoke_alarm"],
  [/^no\s*carbon\s*monoxide/i, ""], // negative = skip
  [/^carbon\s*monoxide/i, "co_alarm"],
  [/^self\s*check-?in/i, "self_checkin"],
  [/^hot\s*tub$/i, "hot_tub"],
  [/^pool$/i, "pool"],
  [/^lake\s*view$/i, "lake_view"],
  [/^lake\s*access|nearby\s*lake/i, "lake"],
  [/^waterfront$/i, "waterfront"],
  [/^bbq|grill$/i, "bbq"],
  [/^fire\s*pit$/i, "fire_pit"],
  [/^workspace|dedicated workspace$/i, "workspace"],
  [/^ev\s*charger$/i, "ev_charger"],
  [/^patio$/i, "patio"],
  [/^balcony$/i, "balcony"],
  [/^dishwasher$/i, "dishwasher"],
];

export type ResolvedAmenity = {
  id: string;
  label: string;
  icon: string;
  groupId: string;
  groupTitle: string;
};

function resolveOption(raw: string): AmenityOption | null {
  const value = raw.trim();
  if (!value) return null;
  if (AMENITY_JUNK.test(value)) return null;
  // Check-in/out times & capacity belong in Things to know, not amenities
  if (CHECKIN_OUT_TIMES.test(value)) return null;
  if (/^\d+\s*guest/i.test(value)) return null;

  const byId = ALL_AMENITY_OPTIONS.find((a) => a.id === value);
  if (byId) return byId;

  const byLabel = ALL_AMENITY_OPTIONS.find(
    (a) => a.label.toLowerCase() === value.toLowerCase(),
  );
  if (byLabel) return byLabel;

  for (const [re, id] of ALIAS_TO_ID) {
    if (re.test(value)) {
      if (!id) return null;
      return ALL_AMENITY_OPTIONS.find((a) => a.id === id) ?? null;
    }
  }

  // Skip long house-rule prose
  if (value.length > 48) return null;
  if (/^no\s+/i.test(value) && !/no carbon/i.test(value)) return null;

  return null;
}

function groupForOptionId(optionId: string): {
  groupId: string;
  groupTitle: string;
} {
  for (const g of AMENITY_DISPLAY_GROUPS) {
    if (g.optionIds.includes(optionId)) {
      return { groupId: g.id, groupTitle: g.title };
    }
  }
  return { groupId: "more", groupTitle: "More" };
}

/**
 * Filter junk, map to catalog, and cluster by similarity for the listing page.
 */
export function groupAmenitiesForDisplay(
  stored: string[],
): { title: string; items: ResolvedAmenity[] }[] {
  const seen = new Set<string>();
  const resolved: ResolvedAmenity[] = [];

  for (const raw of stored) {
    const opt = resolveOption(raw);
    if (!opt) continue;
    if (seen.has(opt.id)) continue;
    seen.add(opt.id);
    const { groupId, groupTitle } = groupForOptionId(opt.id);
    resolved.push({
      id: opt.id,
      label: opt.label,
      icon: opt.icon,
      groupId,
      groupTitle,
    });
  }

  const order = [
    ...AMENITY_DISPLAY_GROUPS.map((g) => g.id),
    "more",
  ];
  const buckets = new Map<string, ResolvedAmenity[]>();
  for (const item of resolved) {
    const list = buckets.get(item.groupId) ?? [];
    list.push(item);
    buckets.set(item.groupId, list);
  }

  return order
    .filter((id) => (buckets.get(id)?.length ?? 0) > 0)
    .map((id) => {
      const items = buckets.get(id)!;
      const title =
        AMENITY_DISPLAY_GROUPS.find((g) => g.id === id)?.title ??
        items[0]?.groupTitle ??
        "More";
      // Stable order within group by catalog order
      const catalogOrder =
        AMENITY_DISPLAY_GROUPS.find((g) => g.id === id)?.optionIds ?? [];
      items.sort(
        (a, b) =>
          catalogOrder.indexOf(a.id) - catalogOrder.indexOf(b.id) ||
          a.label.localeCompare(b.label),
      );
      return { title, items };
    });
}

/** Clean stored amenities for DB (import cleanup / normalize). */
export function sanitizeAmenities(stored: string[]): string[] {
  return groupAmenitiesForDisplay(stored).flatMap((g) =>
    g.items.map((i) => i.label),
  );
}
