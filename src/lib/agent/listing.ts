import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";
import { calculateQuote } from "@/lib/pricing";
import { listingHrefWithSearch } from "@/lib/listing-href";
import { amenityLabelById } from "@/lib/listing-amenities";
import { parseAmenities } from "@/lib/utils";
import { isYmd, nightsBetweenYmd } from "@/lib/search-dates";
import {
  findAvailableWindows,
  isStayAvailable,
} from "@/lib/agent/availability";
import { absoluteUrl } from "@/lib/agent/origin";

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
    contactEmail: string | null;
    contactPhone: string | null;
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
      nightlySubtotal: number;
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
  opts?: { checkIn?: string; checkOut?: string; guests?: number; pets?: number },
): Promise<AgentListingDetail | null> {
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
          contactEmail: true,
          contactPhone: true,
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

  const path = listingHrefWithSearch(property.slug, property.host.slug, {
    checkIn: opts?.checkIn,
    checkOut: opts?.checkOut,
    guests: opts?.guests,
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
      const q = calculateQuote({
        property,
        seasons: property.seasons,
        checkIn: new Date(`${opts.checkIn}T12:00:00`),
        checkOut: new Date(`${opts.checkOut}T12:00:00`),
        pets: opts.pets ?? 0,
      });
      quote = {
        nights: q.nights,
        nightlySubtotal: q.nightlySubtotal,
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
    description: property.description,
    propertyType: property.propertyType,
    spaceType: property.spaceType,
    address: property.showPreciseLocation ? property.address : null,
    city: property.city,
    region: property.region,
    country: property.country,
    postalCode: property.postalCode,
    latitude: property.showPreciseLocation ? property.latitude : null,
    longitude: property.showPreciseLocation ? property.longitude : null,
    showPreciseLocation: property.showPreciseLocation,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    beds: property.beds,
    maxGuests: property.maxGuests,
    baseNightlyRate: property.baseNightlyRate,
    cleaningFee: property.cleaningFee,
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
    images: property.images.map((img) => ({
      url: absoluteUrl(origin, img.url),
      alt: img.alt,
      isCover: img.isCover,
    })),
    host: {
      id: property.host.id,
      name: property.host.name,
      slug: property.host.slug,
      tagline: property.host.tagline,
      contactEmail: property.host.contactEmail,
      contactPhone: property.host.contactPhone,
    },
    url: absoluteUrl(origin, path),
    bookUrl: absoluteUrl(
      origin,
      `/book/${encodeURIComponent(property.slug)}${
        opts?.checkIn && opts?.checkOut
          ? `?checkIn=${opts.checkIn}&checkOut=${opts.checkOut}`
          : ""
      }`,
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
