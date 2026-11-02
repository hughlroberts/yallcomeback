export type ImportSource = "airbnb" | "vrbo" | "unknown";

export type ImportedListingDraft = {
  source: ImportSource;
  sourceUrl: string;
  sourceId: string | null;
  title: string;
  tagline: string | null;
  description: string;
  city: string | null;
  region: string | null;
  country: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  maxGuests: number;
  baseNightlyRate: number | null;
  amenities: string[];
  houseRules: string | null;
  imageUrls: string[];
  rawNotes: string[];
};
