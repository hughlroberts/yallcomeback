"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  formatContinueSearchText,
  formatSearchLabel,
  placeFromHistory,
  searchIsMeaningful,
  searchToMarketplaceHref,
  type RecentSearch,
  type RecentView,
} from "@/lib/browse-history";
import {
  readRecentSearches,
  readRecentViews,
} from "@/lib/browse-history-storage";
import { listingHrefWithSearch } from "@/lib/listing-href";
import { formatMoney } from "@/lib/utils";

type ApiListing = {
  id: string;
  slug: string;
  title: string;
  tagline?: string | null;
  city: string | null;
  region: string | null;
  baseNightlyRate: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms?: number;
  images: { url: string; alt: string | null }[];
  host?: { name: string; slug: string } | null;
};

type Props = {
  /** Hide “continue” when guest is already on that same search */
  currentSearch?: Partial<RecentSearch> | null;
  /** Extra top margin when embedded under marketplace hero */
  className?: string;
};

function HorizontalRail({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        {href ? (
          <Link
            href={href}
            className="group flex min-w-0 items-center gap-1.5 text-left"
          >
            <h2 className="truncate text-xl font-semibold text-stone-900 group-hover:underline">
              {title}
            </h2>
            <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 transition group-hover:text-stone-700" />
          </Link>
        ) : (
          <h2 className="text-xl font-semibold text-stone-900">{title}</h2>
        )}
      </div>
      <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
        {children}
      </div>
    </section>
  );
}

function RailCard({
  href,
  imageUrl,
  imageAlt,
  eyebrow,
  title,
  subtitle,
  meta,
}: {
  href: string;
  imageUrl: string | null;
  imageAlt: string;
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  meta?: string;
}) {
  return (
    <Link
      href={href}
      className="group w-[200px] shrink-0 snap-start sm:w-[220px]"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200 ring-1 ring-black/5">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-cover transition duration-500 group-hover:scale-[1.04]"
            sizes="220px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-stone-400">
            No photo
          </div>
        )}
      </div>
      <div className="mt-2.5 space-y-0.5">
        {eyebrow ? (
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-bonnet">
            {eyebrow}
          </p>
        ) : null}
        <p className="truncate text-sm font-semibold text-stone-900 group-hover:underline">
          {title}
        </p>
        {subtitle ? (
          <p className="truncate text-sm text-stone-500">{subtitle}</p>
        ) : null}
        {meta ? <p className="text-sm text-stone-500">{meta}</p> : null}
      </div>
    </Link>
  );
}

function listingToCard(
  p: ApiListing,
  trip?: RecentSearch | null,
): ReactNode {
  const hostSlug = p.host?.slug ?? "";
  const href = hostSlug
    ? listingHrefWithSearch(p.slug, hostSlug, {
        checkIn: trip?.checkIn,
        checkOut: trip?.checkOut,
        guests: trip?.guests,
        pets: trip?.pets,
      })
    : `/marketplace/properties/${p.slug}`;
  const location = [p.city, p.region].filter(Boolean).join(", ");
  return (
    <RailCard
      key={p.id}
      href={href}
      imageUrl={p.images[0]?.url ?? null}
      imageAlt={p.images[0]?.alt || p.title}
      eyebrow={p.host?.name}
      title={p.title}
      subtitle={location || null}
      meta={`${formatMoney(p.baseNightlyRate)} / night · ${p.bedrooms} bed`}
    />
  );
}

/**
 * Airbnb-style continuity: continue last search, recently viewed,
 * based on previous search, and stay-in place.
 */
export function GuestDiscoverySections({
  currentSearch = null,
  className = "",
}: Props) {
  const [views, setViews] = useState<RecentView[]>([]);
  const [searches, setSearches] = useState<RecentSearch[]>([]);
  const [basedOn, setBasedOn] = useState<ApiListing[]>([]);
  const [stayIn, setStayIn] = useState<ApiListing[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setViews(readRecentViews());
    setSearches(readRecentSearches());
    setReady(true);
  }, []);

  const lastSearch = searches[0] ?? null;
  const activeOnThisSearch =
    currentSearch &&
    searchIsMeaningful(currentSearch) &&
    lastSearch &&
    (currentSearch.where?.trim() || "") === (lastSearch.where?.trim() || "") &&
    (currentSearch.checkIn || "") === (lastSearch.checkIn || "") &&
    (currentSearch.checkOut || "") === (lastSearch.checkOut || "") &&
    (currentSearch.guests || 0) === (lastSearch.guests || 0) &&
    (currentSearch.pets || 0) === (lastSearch.pets || 0);

  const place = useMemo(
    () => placeFromHistory(lastSearch, views),
    [lastSearch, views],
  );

  useEffect(() => {
    if (!ready || !lastSearch) {
      setBasedOn([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (lastSearch.where) params.set("where", lastSearch.where);
    if (lastSearch.checkIn) params.set("checkIn", lastSearch.checkIn);
    if (lastSearch.checkOut) params.set("checkOut", lastSearch.checkOut);
    if (lastSearch.guests) params.set("guests", String(lastSearch.guests));
    if (lastSearch.pets) params.set("pets", String(lastSearch.pets));
    params.set("take", "12");

    fetch(`/api/marketplace/stays?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { listings?: ApiListing[] } | null) => {
        if (cancelled || !data?.listings) return;
        setBasedOn(data.listings);
      })
      .catch(() => {
        if (!cancelled) setBasedOn([]);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, lastSearch]);

  useEffect(() => {
    if (!ready || !place) {
      setStayIn([]);
      return;
    }
    // Skip duplicate of "based on" when place is the same as last search where
    if (
      lastSearch?.where?.trim() &&
      place.toLowerCase() === lastSearch.where.trim().toLowerCase()
    ) {
      setStayIn([]);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams({
      where: place,
      take: "12",
    });
    fetch(`/api/marketplace/stays?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { listings?: ApiListing[] } | null) => {
        if (cancelled || !data?.listings) return;
        setStayIn(data.listings);
      })
      .catch(() => {
        if (!cancelled) setStayIn([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, place, lastSearch]);

  if (!ready) return null;

  const showContinue = Boolean(lastSearch && !activeOnThisSearch);
  const showViews = views.length > 0;
  const showBasedOn =
    Boolean(lastSearch) && basedOn.length > 0 && !activeOnThisSearch;
  const showStayIn = stayIn.length > 0;

  if (!showContinue && !showViews && !showBasedOn && !showStayIn) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
      {showContinue && lastSearch ? (
        <div className="flex justify-center">
          <Link
            href={searchToMarketplaceHref(lastSearch)}
            className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-800 shadow-sm transition hover:border-stone-300 hover:shadow-md"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-700">
              <Home className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 truncate font-medium">
              {formatContinueSearchText(lastSearch)}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          </Link>
        </div>
      ) : null}

      {showViews ? (
        <HorizontalRail title="Recently viewed" href="/marketplace">
          {views.map((v) => {
            const location = [v.city, v.region].filter(Boolean).join(", ");
            return (
              <RailCard
                key={v.id}
                href={`/marketplace/properties/${v.slug}?host=${v.hostSlug}`}
                imageUrl={v.imageUrl}
                imageAlt={v.title}
                title={location || v.title}
                subtitle={location ? v.title : null}
                meta={`${v.bedrooms} bed · ${formatMoney(v.baseNightlyRate)} / night`}
              />
            );
          })}
        </HorizontalRail>
      ) : null}

      {showBasedOn && lastSearch ? (
        <HorizontalRail
          title={`Based on your ${formatSearchLabel(lastSearch)} search`}
          href={searchToMarketplaceHref(lastSearch)}
        >
          {basedOn.map((p) => listingToCard(p, lastSearch))}
        </HorizontalRail>
      ) : null}

      {showStayIn && place ? (
        <HorizontalRail
          title={`Stay in ${place}`}
          href={`/marketplace?tab=stays&where=${encodeURIComponent(place)}`}
        >
          {stayIn.map((p) => listingToCard(p, lastSearch))}
        </HorizontalRail>
      ) : null}
      </div>
    </div>
  );
}
