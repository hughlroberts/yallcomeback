import { prisma } from "./db";
import type { Host, Property } from "@prisma/client";
import { isHostPublicLive } from "./hosting";
import {
  formatDistanceMiles,
  hasCoordinates,
  haversineMiles,
  placeMatchScore,
} from "./geo";

export type PropertyWithHost = Property & {
  host: Pick<Host, "id" | "name" | "slug" | "listOnMarketplace" | "active">;
  images?: { url: string; alt: string | null }[];
};

/**
 * Properties visible on the central marketplace.
 * Free self-host (SELF) hosts always appear when published.
 * Paid (PLATFORM) hosts only when host + property marketplace flags are on
 * and subscription is active.
 */
export function marketplacePropertyWhere() {
  return {
    published: true,
    listOnMarketplace: true,
    host: {
      active: true,
      approvalStatus: "APPROVED" as const,
      OR: [
        // Free self-host → always on free marketplace
        { hostingMode: "SELF" as const },
        // Paid host → must opt into marketplace + active subscription
        {
          hostingMode: "PLATFORM" as const,
          listOnMarketplace: true,
          subscriptionStatus: "ACTIVE" as const,
        },
      ],
    },
  };
}

/** Properties on a single host's branded site */
export function hostSitePropertyWhere(hostId: string) {
  return {
    hostId,
    published: true,
  } as const;
}

export async function getHostBySlug(slug: string) {
  const host = await prisma.host.findFirst({
    where: { slug, active: true },
  });
  if (!host || !isHostPublicLive(host)) return null;
  return host;
}

/** Host row for admin preview even when not public yet */
export async function getHostBySlugAny(slug: string) {
  return prisma.host.findFirst({ where: { slug } });
}

export type MarketplaceSearchOpts = {
  take?: number;
  /** Where - city, region, title, host. Empty / omit = anywhere. */
  q?: string;
  /** Guests (people). Empty / omit = any capacity. */
  guests?: number;
  /** Pets. If > 0, only stays that allow pets. Empty / 0 = no pet filter. */
  pets?: number;
  /** Check-in YYYY-MM-DD - with checkOut, filters calendar availability. */
  checkIn?: string;
  /** Check-out YYYY-MM-DD (exclusive end, same as booking). */
  checkOut?: string;
};

function parseYmd(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Marketplace discovery with optional where / when / who filters.
 * All filters are optional; omit everything → all live marketplace stays.
 */
export async function getMarketplaceListings(opts?: MarketplaceSearchOpts) {
  const q = opts?.q?.trim();
  const guests =
    opts?.guests != null && !Number.isNaN(opts.guests) && opts.guests > 0
      ? Math.floor(opts.guests)
      : undefined;
  const pets =
    opts?.pets != null && !Number.isNaN(opts.pets) && opts.pets > 0
      ? Math.floor(opts.pets)
      : undefined;

  const checkIn = parseYmd(opts?.checkIn);
  const checkOut = parseYmd(opts?.checkOut);
  // Valid stay: checkout after check-in (at least 1 night). Invalid pairs are ignored.
  const nights =
    checkIn && checkOut
      ? Math.round(
          (checkOut.getTime() - checkIn.getTime()) / 86400000,
        )
      : 0;
  const hasDates = Boolean(checkIn && checkOut && nights >= 1);

  const listings = await prisma.property.findMany({
    where: {
      ...marketplacePropertyWhere(),
      ...(guests ? { maxGuests: { gte: guests } } : {}),
      // Traveling with pets → pet-friendly only; hide listings under the max-pet cap
      // (maxPets 0 = no fixed cap). Avoid top-level OR so search q OR still works.
      ...(pets
        ? {
            petsAllowed: true,
            NOT: {
              AND: [{ maxPets: { gt: 0 } }, { maxPets: { lt: pets } }],
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { address: { contains: q } },
              { city: { contains: q } },
              { region: { contains: q } },
              { postalCode: { contains: q } },
              { country: { contains: q } },
              { description: { contains: q } },
              { host: { name: { contains: q } } },
              { location: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          slug: true,
          listOnMarketplace: true,
          active: true,
        },
      },
      images: { orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }], take: 1 },
    },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
  });

  let filtered = listings;

  if (hasDates && checkIn && checkOut) {
    // Drop stays whose listing minimum nights exceeds this trip length
    const capacityOk = filtered.filter((p) => p.defaultMinNights <= nights);

    if (capacityOk.length === 0) {
      filtered = [];
    } else {
      const ids = capacityOk.map((p) => p.id);
      // Any block overlapping [checkIn, checkOut) means unavailable
      const conflicts = await prisma.calendarBlock.findMany({
        where: {
          propertyId: { in: ids },
          startDate: { lt: checkOut },
          endDate: { gt: checkIn },
        },
        select: { propertyId: true },
      });
      const blocked = new Set(conflicts.map((c) => c.propertyId));
      filtered = capacityOk.filter((p) => !blocked.has(p.id));
    }
  }

  if (opts?.take != null) {
    return filtered.slice(0, opts.take);
  }
  return filtered;
}

/**
 * City labels for the Where search autocomplete.
 * Cities only (plus "City, State") from live marketplace listings — no street
 * addresses and no external places API.
 */
export async function getMarketplacePlaceSuggestions(limit = 80) {
  const rows = await prisma.property.findMany({
    where: marketplacePropertyWhere(),
    select: {
      city: true,
      region: true,
    },
    take: 400,
  });

  const labels = new Set<string>();

  for (const r of rows) {
    const city = r.city?.trim() || null;
    const region = r.region?.trim() || null;
    if (!city) continue;
    labels.add(city);
    if (region) labels.add(`${city}, ${region}`);
  }

  return Array.from(labels)
    .filter((s) => s.length >= 2)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

export type NearbyListing = PropertyWithHost & {
  /** Distance in miles (US / Texas). */
  distanceMiles: number | null;
  distanceLabel: string | null;
};

/**
 * Marketplace stays near a listing, ordered by map distance (closest first).
 * Falls back to same city / region when coordinates are missing.
 */
export async function getNearbyMarketplaceListings(
  origin: {
    id: string;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    region: string | null;
  },
  take = 6,
): Promise<NearbyListing[]> {
  const candidates = await prisma.property.findMany({
    where: {
      ...marketplacePropertyWhere(),
      id: { not: origin.id },
    },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          slug: true,
          listOnMarketplace: true,
          active: true,
        },
      },
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
    // Cap for in-memory sort; enough for a small marketplace
    take: 200,
  });

  const originHasCoords = hasCoordinates(origin.latitude, origin.longitude);

  const ranked = candidates.map((p) => {
    let distanceMiles: number | null = null;
    if (
      originHasCoords &&
      hasCoordinates(p.latitude, p.longitude)
    ) {
      distanceMiles = haversineMiles(
        origin.latitude!,
        origin.longitude!,
        p.latitude!,
        p.longitude!,
      );
    }
    return {
      property: p,
      distanceMiles,
      placeScore: placeMatchScore(origin, p),
    };
  });

  ranked.sort((a, b) => {
    if (originHasCoords) {
      const aHas = a.distanceMiles != null;
      const bHas = b.distanceMiles != null;
      // Prefer listings we can measure on the map
      if (aHas && bHas) {
        if (a.distanceMiles! !== b.distanceMiles!) {
          return a.distanceMiles! - b.distanceMiles!;
        }
      } else if (aHas !== bHas) {
        return aHas ? -1 : 1;
      }
    }
    if (a.placeScore !== b.placeScore) {
      return a.placeScore - b.placeScore;
    }
    return a.property.title.localeCompare(b.property.title);
  });

  return ranked.slice(0, take).map(({ property, distanceMiles }) => ({
    ...property,
    distanceMiles,
    distanceLabel: formatDistanceMiles(distanceMiles),
  }));
}

export function hostSiteUrl(hostSlug: string, path = "") {
  const normalized = path && !path.startsWith("/") ? `/${path}` : path;
  return `/h/${hostSlug}${normalized}`;
}

/** Alias used by host-site pages */
export const hostSiteHref = hostSiteUrl;

export function propertyPublicPath(
  property: { slug: string; host?: { slug: string } | null },
  via: "marketplace" | "host" = "marketplace",
) {
  const hostQ = property.host?.slug
    ? `?host=${property.host.slug}`
    : "";
  if (via === "host" && property.host?.slug) {
    // Legacy path - still redirects to marketplace
    return `/h/${property.host.slug}/properties/${property.slug}`;
  }
  return `/marketplace/properties/${property.slug}${hostQ}`;
}
