import { prisma } from "./db";
import type { Host, Property } from "@prisma/client";
import { HOSTING_PUBLIC_STATUSES, isHostPublicLive } from "./hosting";
import {
  formatDistanceMiles,
  hasCoordinates,
  haversineMiles,
  placeMatchScore,
} from "./geo";
import {
  parseRememberSearch,
  rememberHaystack,
  rememberScore,
} from "./remember-search";
import {
  MARKETPLACE_CANDIDATE_CAP,
  MARKETPLACE_PAGE_SIZE,
  marketplaceTextSearchOr,
} from "./marketplace-search";
import {
  computeFlexibleDates,
  FLEX_MAX_ADDED_NIGHTS,
  FLEX_MAX_SHIFT_DAYS,
  stayFit,
  type FlexibleDates,
  type FlexListing,
} from "./flexible-dates";
import { addDaysYmd, nightsBetweenYmd } from "./search-dates";
import {
  hasListingFilters,
  listingMatchesFilters,
  type ListingFilters,
} from "@/lib/search-filters";

export type PropertyWithHost = Property & {
  host: Pick<Host, "id" | "name" | "slug" | "listOnMarketplace" | "active">;
  images?: { url: string; alt: string | null }[];
};

/**
 * Properties visible on the central marketplace.
 * Host and property must both opt into marketplace.
 * Paid (PLATFORM) hosts also need an active subscription.
 * Free self-host (SELF) may opt in or stay off the marketplace entirely.
 */
/**
 * Host slugs that must never appear on the guest marketplace / discovery.
 * (Legacy demos; pricing comps now live in PricingMarketComp only.)
 */
export const MARKETPLACE_EXCLUDED_HOST_SLUGS = [
  "market-comps-demo",
] as const;

export function marketplacePropertyWhere() {
  return {
    published: true,
    listOnMarketplace: true,
    archivedAt: null,
    host: {
      active: true,
      approvalStatus: "APPROVED" as const,
      listOnMarketplace: true,
      // Never surface pricing-agent proxy hosts (or other internal brands)
      slug: { notIn: [...MARKETPLACE_EXCLUDED_HOST_SLUGS] },
      OR: [
        { hostingMode: "SELF" as const },
        {
          hostingMode: "PLATFORM" as const,
          subscriptionStatus: { in: [...HOSTING_PUBLIC_STATUSES] },
        },
      ],
    },
  };
}

/**
 * Guest continuity rails (recently viewed, stay-in place, featured host block)
 * only show once the marketplace has enough inventory to feel full.
 */
export const DISCOVERY_MIN_LISTINGS = 20;

export async function getMarketplaceListingCount(): Promise<number> {
  return prisma.property.count({ where: marketplacePropertyWhere() });
}

/** True when discovery rails / featured stays should render. */
export async function marketplaceDiscoveryEnabled(): Promise<boolean> {
  const count = await getMarketplaceListingCount();
  return count > DISCOVERY_MIN_LISTINGS;
}

/** Host row for admin preview even when not public yet */
export async function getHostBySlugAny(slug: string) {
  return prisma.host.findFirst({ where: { slug } });
}

/**
 * Resolve host for guest site routes: public DEMO/LIVE, or host admin
 * preview of UNPUBLISHED while still building.
 */
export async function getHostForGuestSite(slug: string) {
  const { auth } = await import("./auth");
  const session = await auth();
  const isPlatform = session?.user?.role === "ADMIN";
  const isOwnHost =
    session?.user?.role === "HOST" &&
    session.user.hostId != null;

  // Peek without publish gate first for ownership check
  const any = await getHostBySlugAny(slug);
  if (!any || !any.active) return null;
  if (!isHostPublicLive(any)) {
    // Still allow own host / platform to preview while pending payment/review
    if (isPlatform) return any;
    if (isOwnHost && session!.user.hostId === any.id) return any;
    return null;
  }

  if (any.sitePublishState !== "UNPUBLISHED") return any;

  if (isPlatform) return any;
  if (isOwnHost && session!.user.hostId === any.id) return any;
  return null;
}

export type MarketplaceSearchOpts = {
  take?: number;
  /** Where — city, region, title, host. Never street address. Empty = anywhere. */
  q?: string;
  /** Guests (people). Empty / omit = any capacity. */
  guests?: number;
  /** Pets. If > 0, only stays that allow pets. Empty / 0 = no pet filter. */
  pets?: number;
  /** Check-in YYYY-MM-DD - with checkOut, filters calendar availability. */
  checkIn?: string;
  /** Check-out YYYY-MM-DD (exclusive end, same as booking). */
  checkOut?: string;
  /**
   * ± days flexibility on check-in (Airbnb-style).
   * Stay matches if any window of the same night count starting in
   * [checkIn − flex, checkIn + flex] is free of calendar blocks.
   */
  dateFlex?: number;
  /** Guest memory of a stay they already loved (free text). */
  remember?: string;
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
  return (await searchMarketplace(opts)).listings;
}

type MarketplaceListing = Awaited<
  ReturnType<typeof fetchMarketplacePool>
>[number];

export type MarketplaceSearchResult = {
  listings: MarketplaceListing[];
  /**
   * Every stay matching the search (not cut to the page size), counted over
   * the same candidate pool as flexibleDates.currentCount, so the two agree
   * for exact dates. The pool holds at most MARKETPLACE_CANDIDATE_CAP (200)
   * stays when overfetching (dates, memory, filters or withTotal).
   */
  total: number;
  /**
   * Only when asked for (withFlexibleDates), exact dates are set (no ±flex),
   * results are limited, and a nearby window has more stays.
   */
  flexibleDates: FlexibleDates | null;
};

async function fetchMarketplacePool(
  opts: MarketplaceSearchOpts | undefined,
  input: { guests?: number; pets?: number; candidateLimit: number },
) {
  const q = opts?.q?.trim();
  const { guests, pets } = input;
  return prisma.property.findMany({
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
      ...(q ? { OR: marketplaceTextSearchOr(q) } : {}),
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
    take: input.candidateLimit,
  });
}

/**
 * Search + (optionally) "More stays with flexible dates".
 * One property query, one calendar-block query and one season query; date
 * fit uses stayFit (blocks + listing/peak minimum), the same rule booking uses.
 */
export async function searchMarketplace(
  opts?: MarketplaceSearchOpts,
  extra?: {
    withFlexibleDates?: boolean;
    /** Bedrooms / price / amenities (in memory, before the page slice). */
    filters?: ListingFilters;
    /** Overfetch so `total` is not limited to the page size. */
    withTotal?: boolean;
  },
): Promise<MarketplaceSearchResult> {
  const remembered = parseRememberSearch(opts?.remember);
  const guests =
    opts?.guests != null && !Number.isNaN(opts.guests) && opts.guests > 0
      ? Math.floor(opts.guests)
      : remembered.guests;
  const pets =
    opts?.pets != null && !Number.isNaN(opts.pets) && opts.pets > 0
      ? Math.floor(opts.pets)
      : remembered.pets;

  const checkInYmd = opts?.checkIn && parseYmd(opts.checkIn) ? opts.checkIn : null;
  const checkOutYmd = opts?.checkOut && parseYmd(opts.checkOut) ? opts.checkOut : null;
  // Valid stay: checkout after check-in (at least 1 night). Invalid pairs are ignored.
  const nights =
    checkInYmd && checkOutYmd ? nightsBetweenYmd(checkInYmd, checkOutYmd) : 0;
  const hasDates = Boolean(checkInYmd && checkOutYmd && nights >= 1);
  const dateFlexRaw = opts?.dateFlex ?? 0;
  const dateFlex =
    Number.isFinite(dateFlexRaw) && dateFlexRaw > 0
      ? Math.min(14, Math.floor(dateFlexRaw))
      : 0;

  const pageSize =
    opts?.take != null && Number.isFinite(opts.take) && opts.take > 0
      ? Math.min(100, Math.floor(opts.take))
      : MARKETPLACE_PAGE_SIZE;
  const filters = extra?.filters;
  const hasFilters = hasListingFilters(filters);
  const needsOverfetch =
    hasDates ||
    remembered.tokens.length > 0 ||
    hasFilters ||
    Boolean(extra?.withTotal);
  // Counts (total, currentCount, flexible-date suggestions) must not depend on
  // take / limit, so whenever they are reported, count the full capped pool.
  const wantsCounts =
    Boolean(extra?.withTotal) || Boolean(extra?.withFlexibleDates);
  const candidateLimit = !needsOverfetch
    ? pageSize
    : wantsCounts
      ? MARKETPLACE_CANDIDATE_CAP
      : Math.min(MARKETPLACE_CANDIDATE_CAP, Math.max(pageSize * 4, 80));

  let pool = await fetchMarketplacePool(opts, { guests, pets, candidateLimit });
  // Hit the 200 cap → more stays may exist; suggestion labels say "200+".
  const poolCapped = pool.length >= MARKETPLACE_CANDIDATE_CAP;

  if (filters && hasFilters) {
    pool = pool.filter((p) => listingMatchesFilters(p, filters));
  }

  // Memory search: keep matches only, best first (date fit doesn't reorder).
  if (remembered.tokens.length > 0) {
    pool = pool
      .map((p) => ({
        p,
        score: rememberScore(rememberHaystack(p), remembered.tokens),
      }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.p);
  }

  if (!hasDates || !checkInYmd || !checkOutYmd) {
    return {
      listings: pool.slice(0, pageSize),
      total: pool.length,
      flexibleDates: null,
    };
  }

  const wantFlex = Boolean(extra?.withFlexibleDates) && dateFlex === 0;
  // Calendar data covering every window we may test.
  const reach = Math.max(dateFlex, wantFlex ? FLEX_MAX_SHIFT_DAYS + FLEX_MAX_ADDED_NIGHTS : 0);
  const windowStart = new Date(`${addDaysYmd(checkInYmd, -reach)}T00:00:00`);
  const windowEnd = new Date(`${addDaysYmd(checkOutYmd, reach)}T00:00:00`);
  const ids = pool.map((p) => p.id);

  const [blocks, seasons] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.calendarBlock.findMany({
            where: {
              propertyId: { in: ids },
              startDate: { lt: windowEnd },
              endDate: { gt: windowStart },
            },
            select: { propertyId: true, startDate: true, endDate: true },
          }),
          prisma.seasonalPrice.findMany({
            where: {
              propertyId: { in: ids },
              minNights: { gt: 1 },
              startDate: { lt: windowEnd },
              endDate: { gte: new Date(windowStart.getTime() - 86400000) },
            },
            select: { propertyId: true, startDate: true, endDate: true, minNights: true },
          }),
        ]);

  const flexPool: FlexListing[] = pool.map((p) => ({
    id: p.id,
    defaultMinNights: p.defaultMinNights,
    blocks: blocks
      .filter((b) => b.propertyId === p.id)
      .map((b) => ({ start: b.startDate, end: b.endDate })),
    seasons: seasons.filter((s) => s.propertyId === p.id),
  }));
  const byId = new Map(flexPool.map((f) => [f.id, f]));

  const listings = pool.filter((p) => {
    const f = byId.get(p.id)!;
    if (dateFlex === 0) return stayFit(f, checkInYmd, checkOutYmd) === "ok";
    // Any same-length window with check-in shifted by up to ±flex
    for (let d = -dateFlex; d <= dateFlex; d++) {
      const ci = addDaysYmd(checkInYmd, d);
      if (stayFit(f, ci, addDaysYmd(ci, nights)) === "ok") return true;
    }
    return false;
  });

  const flexibleDates = wantFlex
    ? computeFlexibleDates({
        pool: flexPool,
        checkIn: checkInYmd,
        checkOut: checkOutYmd,
        poolCap: poolCapped ? MARKETPLACE_CANDIDATE_CAP : undefined,
        context: {
          where: opts?.q?.trim() || undefined,
          guests: opts?.guests && opts.guests > 0 ? Math.floor(opts.guests) : undefined,
          pets: opts?.pets && opts.pets > 0 ? Math.floor(opts.pets) : undefined,
          remember: opts?.remember?.trim() || undefined,
          filters: hasFilters ? filters : undefined,
        },
      })
    : null;

  return {
    listings: listings.slice(0, pageSize),
    total: listings.length,
    flexibleDates,
  };
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

/** Distinct city names from Where suggestions (drops "City, State" duplicates). */
export function uniqueCitiesFromPlaceSuggestions(labels: string[]): string[] {
  const cities = new Set<string>();
  for (const label of labels) {
    const city = label.split(",")[0]?.trim();
    if (city) cities.add(city);
  }
  return Array.from(cities);
}

/** When the marketplace only has one city, prefill Where with it. */
export function soleMarketplaceCity(labels: string[]): string | null {
  const cities = uniqueCitiesFromPlaceSuggestions(labels);
  return cities.length === 1 ? cities[0]! : null;
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
