/**
 * First step of the new-listing wizard.
 * Keep this short - only types hosts actually use.
 */
export type ListingTypeId =
  | "house"
  | "cabin"
  | "apartment"
  | "motel"
  | "guesthouse"
  | "hotel"
  | "campsite"
  | "rv"
  | "other";

export type ListingTypeOption = {
  id: ListingTypeId;
  label: string;
  /** Simple emoji icon - no icon library needed */
  icon: string;
};

export const LISTING_TYPES: ListingTypeOption[] = [
  { id: "house", label: "House", icon: "🏠" },
  { id: "cabin", label: "Cabin", icon: "🪵" },
  { id: "apartment", label: "Apartment", icon: "🏢" },
  { id: "motel", label: "Motel room", icon: "🛏️" },
  { id: "guesthouse", label: "Guesthouse", icon: "🏡" },
  { id: "hotel", label: "Hotel", icon: "🏨" },
  { id: "campsite", label: "Campsite", icon: "⛺" },
  { id: "rv", label: "Camper / RV", icon: "🚐" },
  { id: "other", label: "Other", icon: "✨" },
];

export function isListingTypeId(value: string): value is ListingTypeId {
  return LISTING_TYPES.some((t) => t.id === value);
}

export function listingTypeLabel(id: string | null | undefined): string {
  return LISTING_TYPES.find((t) => t.id === id)?.label || "Place";
}

/**
 * Wizard step 2 - what guests get access to.
 * Keep three options only.
 */
export type SpaceTypeId = "entire_place" | "private_room" | "shared_room";

export type SpaceTypeOption = {
  id: SpaceTypeId;
  label: string;
  description: string;
  icon: string;
};

export const SPACE_TYPES: SpaceTypeOption[] = [
  {
    id: "entire_place",
    label: "An entire place",
    description: "Guests have the whole place to themselves.",
    icon: "🏠",
  },
  {
    id: "private_room",
    label: "A room",
    description:
      "Guests have their own room, plus access to shared spaces.",
    icon: "🚪",
  },
  {
    id: "shared_room",
    label: "A shared room",
    description: "Guests sleep in a room or space that others may share.",
    icon: "🛏️",
  },
];

export function isSpaceTypeId(value: string): value is SpaceTypeId {
  return SPACE_TYPES.some((t) => t.id === value);
}

export function spaceTypeLabel(id: string | null | undefined): string {
  return SPACE_TYPES.find((t) => t.id === id)?.label || "Place";
}
