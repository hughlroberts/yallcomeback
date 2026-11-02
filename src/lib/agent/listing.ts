import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";
import { calculateQuote } from "@/lib/pricing";
import { clampGuests } from "@/lib/extra-guests";
import { agentCheckoutBookPath } from "@/lib/agent/book-path";
import { publicListingText } from "@/lib/listing-public-text";
import { listingHrefWithSearch } from "@/lib/listing-href";
import { amenityLabelById } from "@/lib/listing-amenities";
import { parseAmenities } from "@/lib/utils";
import { checkSearchDates, isYmd, nightsBetweenYmd } from "@/lib/search-dates";
import { SearchInputError } from "@/lib/agent/search";
import {
  findAvailableWindows,
  isStayAvailable,
} from "@/lib/agent/availability";
import { absoluteUrl } from "@/lib/agent/origin";
import { listingPhotoAlt } from "@/lib/listing-photo-alt";

/** Street and pin only when the guest listing already shows them. */
export function publicListingLocation(listing: {
  showPreciseLocation: boolean;
  address: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
}) {
  if (listing.showPreciseLocation) {
    return {
      address: listing.address,
      postalCode: listing.postalCode,
      latitude: listing.latitude,
      longitude: listing.longitude,
    };
  }
  return {
    address: null,
    postalCode: null,
    latitude: null,
    longitude: null,
  };
}

export type AgentListingDetail = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  propertyType: string;
  spaceType: string;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  showPreciseLocation: boolean;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  maxGuests: number;
  baseNightlyRate: number;
  cleaningFee: number;
  /** Per night for each guest beyond extraGuestsIncluded; 0 = none */
  extraGuestFee: number;
  /** Guests the base nightly rate covers */
  extraGuestsIncluded: number;
  weekendPremiumPercent: number;
  defaultMinNights: number;
  petsAllowed: boolean;
  maxPets: number;
  petFee: number;
  petFeeUnit: string;
  checkInTime: string;
  checkOutTime: string;
  houseRules: string | null;
  cancellationPolicy: string;
  longTermCancellationPolicy: string;
  amenities: { id: string; label: string }[];
  images: { url: string; alt: string | null; isCover: boolean }[];
  host: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
  };
  url: string;
  bookUrl: string;
  apiUrl: string;
  availability: {
    requested: null | {
      checkIn: string;
      checkOut: string;
      available: boolean;
      nights: number;
    };
    nextWindows: {
      checkIn: string;
      checkOut: string;
      nights: number;
    }[];
    quote: null | {
      nights: number;
      /** Guests the quote is priced for */
      guests: number;
      nightlySubtotal: number;
      /** Guests charged the extra-guest fee */
      extraGuests: number;
      /** Extra-guest charge for the stay (included in totalAmount) */
      extraGuestFee: number;
      cleaningFee: number;
      petFee: number;
      discountAmount: number;
      totalAmount: number;
      depositAmount: number;
      currency: "USD";
      meetsMinNights: boolean;
      error?: string;
    };
  };
};

export async function getAgentListingDetail(
  origin: string,
  slug: string,
  opts?: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    pets?: number;
  },
): Promise<AgentListingDetail | null> {
  // Same date rules (and error codes) as search: bad, past or reversed dates
  // throw SearchInputError, which the API answers with a 400.
  const dates = checkSearchDates(opts?.checkIn, opts?.checkOut);
  if (!dates.ok) throw new SearchInputError(dates.code, dates.error);

  const property = await prisma.property.findFirst({
    where: {
      slug,
      ...marketplacePropertyWhere(),
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          slug: true,
          tagline: true,
        },
      },
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 24,
      },
      seasons: true,
    },
  });

  if (!property) return null;

  const amenityIds = parseAmenities(property.amenities);
  const amenities = amenityIds.map((id) => ({
    id,
    label: amenityLabelById(id) || id,
  }));

  // A party bigger than the listing allows is capped at its max, the same
  // way the quote is, so the links open on the party that was priced.
  const partyGuests =
    opts?.guests != null && Number.isFinite(opts.guests) && opts.guests >= 1
      ? clampGuests(opts.guests, property.maxGuests).guests
      : undefined;

  const path = listingHrefWithSearch(property.slug, property.host.slug, {
    checkIn: opts?.checkIn,
    checkOut: opts?.checkOut,
    guests: partyGuests,
    pets: opts?.pets,
  });

  let requested: AgentListingDetail["availability"]["requested"] = null;
  let quote: AgentListingDetail["availability"]["quote"] = null;

  if (
    opts?.checkIn &&
    opts?.checkOut &&
    isYmd(opts.checkIn) &&
    isYmd(opts.checkOut)
  ) {
    const nights = nightsBetweenYmd(opts.checkIn, opts.checkOut);
    const available =
      nights >= 1
        ? await isStayAvailable(property.id, opts.checkIn, opts.checkOut)
        : false;
    requested = {
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      available,
      nights,
    };
    if (nights >= 1) {
      const quoteGuests = clampGuests(opts.guests, property.maxGuests).guests;
      const q = calculateQuote({
        property,
        seasons: property.seasons,
        checkIn: new Date(`${opts.checkIn}T12:00:00`),
        checkOut: new Date(`${opts.checkOut}T12:00:00`),
        pets: opts.pets ?? 0,
        guests: quoteGuests,
      });
      quote = {
        nights: q.nights,
        guests: quoteGuests,
        nightlySubtotal: q.nightlySubtotal,
        extraGuests: q.extraGuests,
        extraGuestFee: q.extraGuestFee,
        cleaningFee: q.cleaningFee,
        petFee: q.petFee,
        discountAmount: q.discountAmount,
        totalAmount: q.totalAmount,
        depositAmount: q.depositAmount,
        currency: "USD",
        meetsMinNights: q.meetsMinNights,
        ...(q.error ? { error: q.error } : {}),
      };
    }
  }

  const nextWindows = await findAvailableWindows({
    propertyId: property.id,
    nights: Math.max(2, property.defaultMinNights || 1),
    maxWindows: 8,
    lookAheadDays: 120,
    minNights: property.defaultMinNights,
  });

  return {
    id: property.id,
    slug: property.slug,
    title: property.title,
    tagline: property.tagline,
    description: publicListingText(property.description),
    propertyType: property.propertyType,
    spaceType: property.spaceType,
    ...publicListingLocation(property),
    city: property.city,
    region: property.region,
    country: property.country,
    showPreciseLocation: property.showPreciseLocation,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    beds: property.beds,
    maxGuests: property.maxGuests,
    baseNightlyRate: property.baseNightlyRate,
    cleaningFee: property.cleaningFee,
    extraGuestFee: property.extraGuestFee,
    extraGuestsIncluded: property.extraGuestsIncluded,
    weekendPremiumPercent: property.weekendPremiumPercent,
    defaultMinNights: property.defaultMinNights,
    petsAllowed: property.petsAllowed,
    maxPets: property.maxPets,
    petFee: property.petFee,
    petFeeUnit: property.petFeeUnit,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    houseRules: property.houseRules,
    cancellationPolicy: property.cancellationPolicy,
    longTermCancellationPolicy: property.longTermCancellationPolicy,
    amenities,
    images: property.images.map((img, index) => ({
      url: absoluteUrl(origin, img.url),
      alt: listingPhotoAlt(property.title, img.alt, index),
      isCover: img.isCover,
    })),
    host: {
      id: property.host.id,
      name: property.host.name,
      slug: property.host.slug,
      tagline: property.host.tagline,
    },
    url: absoluteUrl(origin, path),
    // Keeps the requested dates, guests and pets so the /book page opens on
    // the same stay the agent quoted.
    bookUrl: absoluteUrl(
      origin,
      agentCheckoutBookPath(property.slug, {
        checkIn: opts?.checkIn,
        checkOut: opts?.checkOut,
        guests: partyGuests,
        pets: opts?.pets,
      }) ?? `/book/${encodeURIComponent(property.slug)}`,
    ),
    apiUrl: absoluteUrl(
      origin,
      `/api/v1/listings/${encodeURIComponent(property.slug)}`,
    ),
    availability: {
      requested,
      nextWindows,
      quote,
    },
  };
}
