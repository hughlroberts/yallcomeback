import Image from "next/image";
import Link from "next/link";
import {
  getMarketplaceListings,
  getMarketplacePlaceSuggestions,
} from "@/lib/host";
import { PropertyCard } from "@/components/property-card";
import { StaySearchForm } from "@/components/stay-search-form";
import { listingHrefWithSearch } from "@/lib/listing-href";
import { GuestDiscoverySections } from "@/components/guest-discovery-sections";
import { TrackRecentSearch } from "@/components/track-browse-history";
import { searchIsMeaningful } from "@/lib/browse-history";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stays" };

type SearchFields = {
  where?: string;
  q?: string;
  guests?: string;
  pets?: string;
  checkIn?: string;
  checkOut?: string;
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
  const where = (params.where ?? params.q)?.trim() || undefined;
  const guests = parsePositiveInt(params.guests);
  const pets = parsePositiveInt(params.pets);
  const checkIn = params.checkIn?.trim() || undefined;
  const checkOut = params.checkOut?.trim() || undefined;

  const placeSuggestions = await getMarketplacePlaceSuggestions();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200/80">
        <div className="absolute inset-0">
          <Image
            src="/seed/hero/marketplace.jpg"
            alt=""
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
            Search by place, dates, and party size - or leave fields blank to see
            everything.
          </p>

          <StaySearchForm
            defaultWhere={where ?? ""}
            defaultCheckIn={checkIn ?? ""}
            defaultCheckOut={checkOut ?? ""}
            defaultGuests={params.guests ?? ""}
            defaultPets={params.pets ?? ""}
            placeSuggestions={placeSuggestions}
          />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <StaysPanel
          where={where}
          guests={guests}
          pets={pets}
          checkIn={checkIn}
          checkOut={checkOut}
          rawGuests={params.guests}
          rawPets={params.pets}
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
  rawGuests,
  rawPets,
}: {
  where?: string;
  guests?: number;
  pets?: number;
  checkIn?: string;
  checkOut?: string;
  rawGuests?: string;
  rawPets?: string;
}) {
  const listings = await getMarketplaceListings({
    q: where,
    guests,
    pets,
    checkIn,
    checkOut,
  });

  const filters: string[] = [];
  if (where) filters.push(`near “${where}”`);
  else filters.push("anywhere");
  if (checkIn && checkOut) filters.push(`${checkIn} → ${checkOut}`);
  if (guests) filters.push(`${guests} guest${guests === 1 ? "" : "s"}`);
  if (pets) filters.push(`${pets} pet${pets === 1 ? "" : "s"}`);

  const currentSearch = {
    where,
    checkIn,
    checkOut,
    guests,
    pets,
  };
  const hasActiveSearch = searchIsMeaningful(currentSearch);

  return (
    <>
      {hasActiveSearch ? (
        <TrackRecentSearch
          where={where}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          pets={pets}
          resultCount={listings.length}
        />
      ) : null}

      {!hasActiveSearch ? (
        <GuestDiscoverySections
          currentSearch={currentSearch}
          className="mb-4 -mx-4 sm:-mx-6"
        />
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-500">
          {listings.length} stay{listings.length === 1 ? "" : "s"}
          <span className="text-slate-400"> · {filters.join(" · ")}</span>
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
            })}
            showHost
          />
        ))}
      </div>
      {listings.length === 0 ? (
        <p className="mt-16 text-center text-slate-500">
          No stays match these filters. Try different dates, fewer guests, or
          leave pets blank if you&apos;re not traveling with animals.
        </p>
      ) : null}

      {hasActiveSearch ? (
        <GuestDiscoverySections
          currentSearch={currentSearch}
          className="mt-8 border-t border-slate-200 -mx-4 sm:-mx-6"
        />
      ) : null}
    </>
  );
}
