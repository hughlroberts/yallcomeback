import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { Host, Property } from "@prisma/client";

/**
 * Remote self-host / open-source instances can push listings to the central
 * Yall Come Back marketplace using a host syndication API key.
 *
 * On-platform free self-host (hostingMode=SELF, same DB) does not need this —
 * toggle listOnMarketplace on the host + property.
 */

export function generateSyndicationApiKey(): string {
  return `ycb_syn_${randomBytes(24).toString("hex")}`;
}

/** Prefix for display (full key only shown once after rotate). */
export function maskSyndicationKey(key: string | null | undefined): string {
  if (!key) return "—";
  if (key.length < 16) return "••••";
  return `${key.slice(0, 12)}…${key.slice(-4)}`;
}

export async function hostFromSyndicationKey(
  authHeader: string | null,
): Promise<Host | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice("Bearer ".length).trim();
  if (!key.startsWith("ycb_syn_") || key.length < 20) return null;
  return prisma.host.findFirst({
    where: {
      syndicationApiKey: key,
      active: true,
      approvalStatus: "APPROVED",
    },
  });
}

export type SyndicationListingInput = {
  /** Stable slug on the central host brand (unique per host). */
  slug: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  propertyType?: string;
  spaceType?: string;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  beds?: number;
  baseNightlyRate: number;
  defaultMinNights?: number;
  cleaningFee?: number;
  petFee?: number;
  petsAllowed?: boolean;
  maxPets?: number;
  depositPercent?: number;
  checkInTime?: string;
  checkOutTime?: string;
  houseRules?: string | null;
  amenities?: string[] | string;
  published?: boolean;
  /** Defaults true when host has marketplace on; false never lists. */
  listOnMarketplace?: boolean;
  images?: { url: string; alt?: string | null; isCover?: boolean }[];
};

function asAmenitiesJson(raw: SyndicationListingInput["amenities"]): string {
  if (Array.isArray(raw)) return JSON.stringify(raw);
  if (typeof raw === "string" && raw.trim()) {
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      return JSON.stringify([raw]);
    }
  }
  return "[]";
}

/**
 * Upsert a marketplace-facing listing for a self-host / open-source brand.
 * Returns the central property row.
 */
export async function upsertSyndicatedListing(
  host: Host,
  input: SyndicationListingInput,
): Promise<Property> {
  const slug = input.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length < 2) {
    throw new Error("slug is required (2+ chars, a-z 0-9 hyphen)");
  }
  if (!input.title?.trim()) throw new Error("title is required");
  if (
    !Number.isFinite(input.baseNightlyRate) ||
    input.baseNightlyRate < 0
  ) {
    throw new Error("baseNightlyRate must be a non-negative number");
  }

  // Host must opt into marketplace for any syndicated listing to show there
  const wantMarketplace =
    host.listOnMarketplace && input.listOnMarketplace !== false;

  const data = {
    title: input.title.trim(),
    tagline: input.tagline?.trim() || null,
    description: input.description?.trim() || null,
    propertyType: input.propertyType?.trim() || "house",
    spaceType: input.spaceType?.trim() || "entire_place",
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    region: input.region?.trim() || null,
    country: input.country?.trim() || null,
    postalCode: input.postalCode?.trim() || null,
    latitude:
      typeof input.latitude === "number" && Number.isFinite(input.latitude)
        ? input.latitude
        : null,
    longitude:
      typeof input.longitude === "number" && Number.isFinite(input.longitude)
        ? input.longitude
        : null,
    bedrooms: Math.max(0, Math.floor(input.bedrooms ?? 1)),
    bathrooms: Math.max(0, Number(input.bathrooms ?? 1)),
    maxGuests: Math.max(1, Math.floor(input.maxGuests ?? 2)),
    beds: Math.max(0, Math.floor(input.beds ?? 1)),
    baseNightlyRate: input.baseNightlyRate,
    defaultMinNights: Math.max(1, Math.floor(input.defaultMinNights ?? 1)),
    cleaningFee: Math.max(0, Number(input.cleaningFee ?? 0)),
    petFee: Math.max(0, Number(input.petFee ?? 0)),
    petsAllowed: Boolean(input.petsAllowed),
    maxPets: Math.max(0, Math.floor(input.maxPets ?? 2)),
    depositPercent: Math.min(
      100,
      Math.max(0, Number(input.depositPercent ?? 30)),
    ),
    checkInTime: input.checkInTime?.trim() || "16:00",
    checkOutTime: input.checkOutTime?.trim() || "11:00",
    houseRules: input.houseRules?.trim() || null,
    amenities: asAmenitiesJson(input.amenities),
    published: Boolean(input.published),
    listOnMarketplace: wantMarketplace,
  };

  const existing = await prisma.property.findUnique({
    where: { hostId_slug: { hostId: host.id, slug } },
  });

  let property: Property;
  if (existing) {
    property = await prisma.property.update({
      where: { id: existing.id },
      data,
    });
  } else {
    property = await prisma.property.create({
      data: {
        hostId: host.id,
        slug,
        ...data,
        icalConnections: {
          create: { name: "Export feed", enabled: true },
        },
      },
    });
  }

  if (input.images && input.images.length > 0) {
    await prisma.propertyImage.deleteMany({
      where: { propertyId: property.id },
    });
    await prisma.propertyImage.createMany({
      data: input.images
        .filter((img) => img.url?.trim())
        .slice(0, 40)
        .map((img, i) => ({
          propertyId: property.id,
          url: img.url.trim(),
          alt: img.alt?.trim() || null,
          sortOrder: i,
          isCover: Boolean(img.isCover) || i === 0,
        })),
    });
  }

  return property;
}

export function marketplacePublicUrl(
  origin: string,
  propertySlug: string,
  hostSlug: string,
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/marketplace/properties/${encodeURIComponent(propertySlug)}?host=${encodeURIComponent(hostSlug)}`;
}

export function fingerprintPayload(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 16);
}
