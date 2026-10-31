import { searchMarketplace } from "@/lib/host";
import type {
  FlexibleDates,
  FlexibleDateSuggestion,
} from "@/lib/flexible-dates";
import { calculateQuote } from "@/lib/pricing";
import { listingHrefWithSearch } from "@/lib/listing-href";
import { checkSearchDates, isYmd, nightsBetweenYmd } from "@/lib/search-dates";
import { prisma } from "@/lib/db";
import {
  findAvailableWindows,
  flexibleWindowsAround,
  type AvailableWindow,
} from "@/lib/agent/availability";
import { absoluteUrl } from "@/lib/agent/origin";
import {
  appendListingFilterParams,
  normalizeListingFilters,
} from "@/lib/search-filters";

/** Bad search input (past or inverted dates, bad format) → HTTP 400. */
export class SearchInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SearchInputError";
  }
}

export type AgentSearchParams = {
  /** Free-text location / city / region / host / title */
  location?: string;
  checkIn?: string;
  checkOut?: string;
  /** true = treat as “I’m flexible” (omit strict dates or use flexibility) */
  flexible?: boolean;
  /** ± days on check-in when dates provided (default 0; max 14) */
  flexibilityDays?: number;
  guests?: number;
  pets?: number;
  bedrooms?: number;
  minNightly?: number;
  maxNightly?: number;
  /** Amenity ids or free-text labels (any match) */
  amenities?: string[];
  take?: number;
};

export type AgentListingSummary = {
  id: string;
  /** Property (listing) slug — never the host brand slug */
  slug: string;
  /** Host brand slug (e.g. cherokee-landing). Separate from listing slug. */
  hostSlug: string;
  title: string;
  tagline: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  propertyType: string;
  baseNightlyRate: number;
  cleaningFee: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  petsAllowed: boolean;
  maxPets: number;
  defaultMinNights: number;
  amenities: string[];
  coverImage: string | null;
  host: { id: string; name: string; slug: string };
  /** Deep link into marketplace UI (with search params when known) */
  url: string;
  bookUrl: string;
  apiUrl: string;
  priceEstimate: null | {
    nights: number;
    checkIn: string;
    checkOut: string;
    nightlySubtotal: number;
    cleaningFee: number;
    totalBeforeTax: number;
    currency: "USD";
  };
  /** Free windows when flexible search or dates with ± flex */
  availableWindows: AvailableWindow[];
};

export type AgentSearchResult = {
  query: AgentSearchParams & {
    flexible: boolean;
    flexibilityDays: number;
  };
  /**
   * All stays matching the search, not cut to `take` (same pool and rule as
   * flexibleDates.currentCount, so the two agree for exact dates). Counted
   * over at most 200 candidate stays.
   */
  count: number;
  /** Listings in this response (count capped by take). */
  returned: number;
  listings: AgentListingSummary[];
  humanSearchUrl: string;
  /**
   * Exact dates + few results → nearby windows with more stays
   * (same length shifted ±1–3 days, or longer to meet a minimum). Else null.
   */
  flexibleDates:
    | (Omit<FlexibleDates, "suggestions"> & {
        suggestions: (FlexibleDateSuggestion & { searchUrl: string })[];
      })
    | null;
  docs: string;
};

function parseAmenities(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (Array.isArray(j)) return j.map(String);
  } catch {
    /* ignore */
  }
  return [];
}

export async function agentSearch(
  origin: string,
  params: AgentSearchParams,
): Promise<AgentSearchResult> {
  const dates = checkSearchDates(params.checkIn, params.checkOut);
  if (!dates.ok) throw new SearchInputError(dates.code, dates.error);
  const take = Math.min(50, Math.max(1, params.take ?? 20));
  const flexible = Boolean(params.flexible);
  let flexibilityDays = Math.min(
    14,
    Math.max(0, Math.floor(params.flexibilityDays ?? 0)),
  );
  // “I’m flexible” with dates but no explicit flex → default ±3 days
  if (flexible && flexibilityDays === 0 && params.checkIn && params.checkOut) {
    flexibilityDays = 3;
  }

  const hasExactDates =
    Boolean(params.checkIn && params.checkOut) &&
    isYmd(params.checkIn || "") &&
    isYmd(params.checkOut || "") &&
    nightsBetweenYmd(params.checkIn!, params.checkOut!) >= 1;

  // Flexible without any dates → no calendar filter; enrich with next windows later
  // Flexible with dates → dateFlex
  // Exact (not flexible) with dates → dateFlex 0
  const dateFlex =
    hasExactDates && (flexible || flexibilityDays > 0) ? flexibilityDays : 0;

  const filters = normalizeListingFilters({
    bedrooms: params.bedrooms,
    minNightly: params.minNightly,
    maxNightly: params.maxNightly,
    amenities: params.amenities,
  });

  // Bedroom / price / amenity filters run on the candidate pool (before the
  // page slice) so count and flexibleDates honor them, and every link keeps them.
  const {
    listings: found,
    total,
    flexibleDates,
  } = await searchMarketplace(
    {
      q: params.location,
      checkIn: hasExactDates ? params.checkIn : undefined,
      checkOut: hasExactDates ? params.checkOut : undefined,
      dateFlex: hasExactDates ? dateFlex : 0,
      guests: params.guests,
      pets: params.pets,
      take,
    },
    { withFlexibleDates: true, withTotal: true, filters },
  );
  const listings = found.slice(0, take);

  // Seasons for quotes (batch)
  const seasonsByProp = new Map<
    string,
    {
      startDate: Date;
      endDate: Date;
      nightlyRate: number;
      minNights: number;
      name: string;
    }[]
  >();
  if (hasExactDates && listings.length > 0) {
    const seasons = await prisma.seasonalPrice.findMany({
      where: { propertyId: { in: listings.map((p) => p.id) } },
      select: {
        propertyId: true,
        startDate: true,
        endDate: true,
        nightlyRate: true,
        minNights: true,
        name: true,
      },
    });
    for (const s of seasons) {
      const list = seasonsByProp.get(s.propertyId) || [];
      list.push(s);
      seasonsByProp.set(s.propertyId, list);
    }
  }

  const results: AgentListingSummary[] = [];

  for (const p of listings) {
    // Always the property slug — never host.slug (host brand lives in hostSlug).
    const listingSlug = p.slug;
    const hostSlug = p.host.slug;
    const searchForHref = {
      checkIn: hasExactDates ? params.checkIn : undefined,
      checkOut: hasExactDates ? params.checkOut : undefined,
      guests: params.guests,
      pets: params.pets,
    };
    const path = listingHrefWithSearch(listingSlug, hostSlug, searchForHref);
    const url = absoluteUrl(origin, path);
    const bookUrl = absoluteUrl(
      origin,
      `/book/${encodeURIComponent(listingSlug)}${hasExactDates ? `?checkIn=${params.checkIn}&checkOut=${params.checkOut}` : ""}`,
    );
    const apiUrl = absoluteUrl(
      origin,
      `/api/v1/listings/${encodeURIComponent(listingSlug)}`,
    );

    let priceEstimate: AgentListingSummary["priceEstimate"] = null;
    let availableWindows: AvailableWindow[] = [];

    if (hasExactDates && dateFlex === 0) {
      const quote = calculateQuote({
        property: p,
        seasons: seasonsByProp.get(p.id) || [],
        checkIn: new Date(`${params.checkIn}T12:00:00`),
        checkOut: new Date(`${params.checkOut}T12:00:00`),
        pets: params.pets ?? 0,
      });
      if (!quote.error) {
        priceEstimate = {
          nights: quote.nights,
          checkIn: params.checkIn!,
          checkOut: params.checkOut!,
          nightlySubtotal: quote.nightlySubtotal,
          cleaningFee: quote.cleaningFee,
          totalBeforeTax:
            quote.nightlySubtotal -
            quote.discountAmount +
            quote.cleaningFee +
            quote.petFee,
          currency: "USD",
        };
      }
    } else if (hasExactDates && dateFlex > 0) {
      availableWindows = await flexibleWindowsAround({
        propertyId: p.id,
        checkIn: params.checkIn!,
        checkOut: params.checkOut!,
        flexibilityDays: dateFlex,
      });
      // Price the preferred window if free, else first available
      const prefer =
        availableWindows.find(
          (w) => w.checkIn === params.checkIn && w.checkOut === params.checkOut,
        ) || availableWindows[0];
      if (prefer) {
        const seasons =
          seasonsByProp.get(p.id) ||
          (await prisma.seasonalPrice.findMany({
            where: { propertyId: p.id },
          }));
        const quote = calculateQuote({
          property: p,
          seasons,
          checkIn: new Date(`${prefer.checkIn}T12:00:00`),
          checkOut: new Date(`${prefer.checkOut}T12:00:00`),
          pets: params.pets ?? 0,
        });
        if (!quote.error) {
          priceEstimate = {
            nights: quote.nights,
            checkIn: prefer.checkIn,
            checkOut: prefer.checkOut,
            nightlySubtotal: quote.nightlySubtotal,
            cleaningFee: quote.cleaningFee,
            totalBeforeTax:
              quote.nightlySubtotal -
              quote.discountAmount +
              quote.cleaningFee +
              quote.petFee,
            currency: "USD",
          };
        }
      }
    } else if (flexible || !hasExactDates) {
      // Next free windows (default 2 nights or listing min)
      const nights = Math.max(2, p.defaultMinNights || 1);
      availableWindows = await findAvailableWindows({
        propertyId: p.id,
        nights,
        maxWindows: 3,
        lookAheadDays: 90,
        minNights: p.defaultMinNights,
      });
    }

    results.push({
      id: p.id,
      slug: listingSlug,
      hostSlug,
      title: p.title,
      tagline: p.tagline,
      city: p.city,
      region: p.region,
      country: p.country,
      propertyType: p.propertyType,
      baseNightlyRate: p.baseNightlyRate,
      cleaningFee: p.cleaningFee,
      maxGuests: p.maxGuests,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      beds: p.beds,
      petsAllowed: p.petsAllowed,
      maxPets: p.maxPets,
      defaultMinNights: p.defaultMinNights,
      amenities: parseAmenities(p.amenities),
      coverImage: p.images[0]?.url
        ? absoluteUrl(origin, p.images[0].url)
        : null,
      host: {
        id: p.host.id,
        name: p.host.name,
        slug: hostSlug,
      },
      url,
      bookUrl,
      apiUrl,
      priceEstimate,
      availableWindows,
    });
  }

  const humanParams = new URLSearchParams();
  if (params.location) humanParams.set("where", params.location);
  if (hasExactDates) {
    humanParams.set("checkIn", params.checkIn!);
    humanParams.set("checkOut", params.checkOut!);
    if (dateFlex > 0) humanParams.set("dateFlex", String(dateFlex));
  }
  if (params.guests) humanParams.set("guests", String(params.guests));
  if (params.pets) humanParams.set("pets", String(params.pets));
  appendListingFilterParams(humanParams, filters);

  return {
    query: {
      ...params,
      flexible: flexible || !hasExactDates,
      flexibilityDays: dateFlex,
    },
    count: total,
    returned: results.length,
    listings: results,
    humanSearchUrl: absoluteUrl(
      origin,
      `/marketplace${humanParams.toString() ? `?${humanParams}` : ""}`,
    ),
    flexibleDates: flexibleDates
      ? {
          ...flexibleDates,
          suggestions: flexibleDates.suggestions.map((sug) => ({
            ...sug,
            searchUrl: absoluteUrl(origin, sug.searchPath),
          })),
        }
      : null,
    docs: absoluteUrl(origin, "/llms.txt"),
  };
}
