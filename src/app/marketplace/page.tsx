import Image from "next/image";
import Link from "next/link";
import {
  getMarketplaceListingCount,
  getMarketplacePlaceSuggestions,
  marketplaceDiscoveryEnabled,
  searchMarketplace,
  soleMarketplaceCity,
} from "@/lib/host";
import { FlexibleDatesPanel } from "@/components/flexible-dates-panel";
import { PropertyCard } from "@/components/property-card";
import { StaySearchForm } from "@/components/stay-search-form";
import { listingHrefWithSearch } from "@/lib/listing-href";
import { ambiguousMarketplaceSlugs } from "@/lib/marketplace-slugs";
import { GuestDiscoverySections } from "@/components/guest-discovery-sections";
import { TrackRecentSearch } from "@/components/track-browse-history";
import { searchIsMeaningful } from "@/lib/browse-history";
import { checkSearchDates } from "@/lib/search-dates";
import { searchFormKey } from "@/lib/search-date-sync";
import {
  appendListingFilterParams,
  hasListingFilters,
  listingFilterLabels,
  listingFiltersFromParams,
  type ListingFilters, SEARCH_MAX_LOCATION_CHARS } from "@/lib/search-filters";

import { pageMetadata } from "@/lib/seo";
import { PageJsonLd } from "@/components/page-json-ld";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Find a Place",
  description:
    "Find a stay you already love — and book the host who made it great. Search lakeside and return-guest stays on Yall Come Back.",
  path: "/marketplace",
});

type SearchFields = {
  where?: string;
  q?: string;
  guests?: string;
  pets?: string;
  checkIn?: string;
  checkOut?: string;
  dateFlex?: string;
  remember?: string;
  bedrooms?: string;
  minNightly?: string;
  maxNightly?: string;
  amenities?: string;
  amenity?: string;
};

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchFields>;
}) {
  const params = await searchParams;

  // where preferred; legacy ?q= still works
  // R1104-13: an over-long where is cut to SEARCH_MAX_LOCATION_CHARS.
  const where =
    (params.where ?? params.q)?.trim().slice(0, SEARCH_MAX_LOCATION_CHARS).trim() ||
    undefined;
  const guests = parsePositiveInt(params.guests);
  const pets = parsePositiveInt(params.pets);
  // Past, inverted or malformed dates: say so and search without dates
  // (the APIs answer 400 for the same input).
  const dateCheck = checkSearchDates(params.checkIn, params.checkOut);
  const dateMessage = dateCheck.ok ? undefined : dateCheck.message;
  const checkIn = dateCheck.ok ? dateCheck.checkIn : undefined;
  const checkOut = dateCheck.ok ? dateCheck.checkOut : undefined;
  const filters = listingFiltersFromParams(
    (k) => params[k as keyof SearchFields],
  );
  // Resubmitting the form keeps bedrooms / price / amenity filters.
  const filterParams = new URLSearchParams();
  appendListingFilterParams(filterParams, filters);
  const hiddenFields = Object.fromEntries(filterParams.entries());
  const dateFlexRaw = Number(params.dateFlex);
  const dateFlex =
    Number.isFinite(dateFlexRaw) && dateFlexRaw > 0
      ? Math.min(14, Math.floor(dateFlexRaw))
      : 0;

  const placeSuggestions = await getMarketplacePlaceSuggestions();
  const onlyCity = soleMarketplaceCity(placeSuggestions);

  return (
    <div>
      <PageJsonLd path="/marketplace" name="Find a Place" metadata={metadata} kind="CollectionPage" />
      <section className="relative overflow-hidden border-b border-slate-200/80">
        <div className="absolute inset-0">
          <Image
            src="/seed/hero/marketplace.jpg"
            alt="Lake view through a screened porch window at a marketplace stay"
            fill
            className="object-cover opacity-30"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-white" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 md:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-bonnet">
            Explore
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Places to stay
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Find a stay you already love — or discover one worth coming back to.
            Search by place, dates, and party size, or describe the stay you
            remember.
          </p>

          <StaySearchForm
            // Remount from the URL on every search change (e.g. a flexible-date
            // chip), so no field keeps the previous search's values.
            key={searchFormKey({
              where: where ?? onlyCity ?? "",
              checkIn,
              checkOut,
              dateFlex,
              guests: params.guests,
              pets: params.pets,
              remember: params.remember,
            })}
            defaultWhere={where ?? onlyCity ?? ""}
            defaultCheckIn={checkIn ?? ""}
            defaultCheckOut={checkOut ?? ""}
            defaultDateFlex={dateFlex || ""}
            defaultGuests={params.guests ?? ""}
            defaultPets={params.pets ?? ""}
            defaultRemember={params.remember ?? ""}
            placeSuggestions={placeSuggestions}
            hiddenFields={hiddenFields}
          />
          {dateMessage ? (
            <p
              role="alert"
              className="mt-3 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              {dateMessage} Showing stays for any dates.
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <StaysPanel
          where={where}
          guests={guests}
          pets={pets}
          checkIn={checkIn}
          checkOut={checkOut}
          dateFlex={dateFlex}
          remember={params.remember?.trim() || undefined}
          rawGuests={params.guests}
          rawPets={params.pets}
          listingFilters={filters}
        />
      </div>
    </div>
  );
}

async function StaysPanel({
  where,
  guests,
  pets,
  checkIn,
  checkOut,
  dateFlex = 0,
  remember,
  rawGuests,
  rawPets,
  listingFilters,
}: {
  where?: string;
  guests?: number;
  pets?: number;
  checkIn?: string;
  checkOut?: string;
  dateFlex?: number;
  remember?: string;
  rawGuests?: string;
  rawPets?: string;
  listingFilters: ListingFilters;
}) {
  const currentSearch = {
    where,
    checkIn,
    checkOut,
    guests,
    pets,
    remember,
  };
  const hasFilters = hasListingFilters(listingFilters);
  const hasActiveSearch = searchIsMeaningful(currentSearch) || hasFilters;

  const [{ listings, total, flexibleDates }, showDiscovery, totalListingCount] =
    await Promise.all([
      searchMarketplace(
        {
          q: where,
          guests,
          pets,
          checkIn,
          checkOut,
          dateFlex,
          remember,
          take: 24,
        },
        {
          withFlexibleDates: true,
          withTotal: true,
          filters: hasFilters ? listingFilters : undefined,
        },
      ),
      marketplaceDiscoveryEnabled(),
      // Unfiltered browse uses the shared published-marketplace count.
      hasActiveSearch
        ? Promise.resolve(null)
        : getMarketplaceListingCount(),
    ]);

  // Card links use the clean canonical URL unless the slug is shared.
  const ambiguousSlugs = await ambiguousMarketplaceSlugs(
    listings.map((p) => p.slug),
  );

  // Same total as flexibleDates.currentCount (not cut to the 24 shown).
  const stayCount = hasActiveSearch
    ? total
    : (totalListingCount ?? listings.length);

  const filters: string[] = [];
  if (where) filters.push(`near “${where}”`);
  else if (!showDiscovery) {
    filters.push("we're new and still getting started");
  }
  if (checkIn && checkOut) {
    filters.push(
      dateFlex > 0
        ? `${checkIn} → ${checkOut} (±${dateFlex}d)`
        : `${checkIn} → ${checkOut}`,
    );
  }
  if (guests) filters.push(`${guests} guest${guests === 1 ? "" : "s"}`);
  if (pets) filters.push(`${pets} pet${pets === 1 ? "" : "s"}`);
  filters.push(...listingFilterLabels(listingFilters));
  if (remember) filters.push("from what you remember");

  return (
    <>
      {hasActiveSearch ? (
        <TrackRecentSearch
          where={where}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          pets={pets}
          remember={remember}
          resultCount={listings.length}
        />
      ) : null}

      {showDiscovery && !hasActiveSearch ? (
        <GuestDiscoverySections
          currentSearch={currentSearch}
          className="mb-4 -mx-4 sm:-mx-6"
        />
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-500">
          {hasActiveSearch && stayCount > listings.length
            ? `Showing ${listings.length} of ${stayCount} stays`
            : `${stayCount} stay${stayCount === 1 ? "" : "s"}`}
          {filters.length > 0 ? (
            <span className="text-slate-400"> · {filters.join(" · ")}</span>
          ) : null}
        </p>
        {hasActiveSearch ? (
          <Link
            href="/marketplace"
            className="text-sm font-medium text-bonnet hover:underline"
          >
            Clear search
          </Link>
        ) : null}
      </div>
      <FlexibleDatesPanel flexibleDates={flexibleDates} className="mt-4" />
      {/* R1104-17: card titles are h3, so give them an h2 parent. */}
      <h2 className="sr-only">Stays</h2>
      <div className="mt-6 grid gap-6 sm:mt-8 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10">
        {listings.map((p) => (
          <PropertyCard
            key={p.id}
            property={p}
            href={listingHrefWithSearch(p.slug, p.host.slug, {
              checkIn,
              checkOut,
              guests: rawGuests || guests,
              pets: rawPets || pets,
            }, ambiguousSlugs)}
            showHost
          />
        ))}
      </div>
      {listings.length === 0 ? (
        <p className="mt-16 text-center text-slate-500">
          No stays match these filters. Try a shorter memory, different dates,
          or fewer guests.
        </p>
      ) : null}

      {showDiscovery && hasActiveSearch ? (
        <GuestDiscoverySections
          currentSearch={currentSearch}
          className="mt-8 border-t border-slate-200 -mx-4 sm:-mx-6"
        />
      ) : null}
    </>
  );
}
