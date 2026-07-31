/**
 * Wizard amenity picks - grouped like a simple host setup flow.
 * Stored as label strings in Property.amenities JSON.
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
  { id: "gym", label: "Gym", icon: "🏋️" },
  { id: "hot_tub", label: "Hot tub", icon: "♨️" },
  { id: "fireplace", label: "Indoor fireplace", icon: "🔥" },
  { id: "outdoor_furniture", label: "Outdoor furniture", icon: "🪑" },
  { id: "pool", label: "Pool", icon: "🏊" },
  { id: "pets", label: "Pets allowed", icon: "🐾" },
];

export const AMENITY_LOCATION: AmenityOption[] = [
  { id: "beach", label: "Beach access", icon: "🏖️" },
  { id: "waterfront", label: "Waterfront", icon: "🌊" },
  { id: "lake", label: "Lake access", icon: "🛶" },
];

export const AMENITY_SAFETY: AmenityOption[] = [
  { id: "smoke_alarm", label: "Smoke alarm", icon: "🚨" },
  { id: "co_alarm", label: "Carbon monoxide alarm", icon: "⚠️" },
  { id: "fire_extinguisher", label: "Fire extinguisher", icon: "🧯" },
  { id: "first_aid", label: "First aid kit", icon: "🩹" },
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
