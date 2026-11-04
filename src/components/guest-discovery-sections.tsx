"use client";

import Image from "next/image";
import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
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
import { listingPhotoAlt } from "@/lib/listing-photo-alt";
import { formatMoney } from "@/lib/utils";
import { checkSearchDates } from "@/lib/search-dates";
import { SEARCH_MAX_PETS, plainWholeNumber } from "@/lib/search-filters";

const emptyViews: RecentView[] = [];
const emptySearches: RecentSearch[] = [];

function subscribeNoop() {
  return () => {};
}

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
  /** From /api/marketplace/stays: slug shared across hosts → keep ?host= */
  slugShared?: boolean;
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
      }, p.slugShared ? new Set([p.slug]) : new Set<string>())
    : `/marketplace/properties/${p.slug}`;
  const location = [p.city, p.region].filter(Boolean).join(", ");
  return (
    <RailCard
      key={p.id}
      href={href}
      imageUrl={p.images[0]?.url ?? null}
      imageAlt={listingPhotoAlt(p.title, p.images[0]?.alt, 0)}
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
  // localStorage via useSyncExternalStore (no setState-in-effect)
  const views = useSyncExternalStore(
    subscribeNoop,
    readRecentViews,
    () => emptyViews,
  );
  const searches = useSyncExternalStore(
    subscribeNoop,
    readRecentSearches,
    () => emptySearches,
  );
  /** Fetched results keyed by request so we never need to clear with setState. */
  const [basedOnPack, setBasedOnPack] = useState<{
    key: string;
    items: ApiListing[];
  }>({ key: "", items: [] });
  const [stayInPack, setStayInPack] = useState<{
    key: string;
    items: ApiListing[];
  }>({ key: "", items: [] });

  const lastSearch = searches[0] ?? null;
  const activeOnThisSearch =
    currentSearch &&
    searchIsMeaningful(currentSearch) &&
    lastSearch &&
    (currentSearch.where?.trim() || "") === (lastSearch.where?.trim() || "") &&
    (currentSearch.checkIn || "") === (lastSearch.checkIn || "") &&
    (currentSearch.checkOut || "") === (lastSearch.checkOut || "") &&
    (currentSearch.guests || 0) === (lastSearch.guests || 0) &&
    (currentSearch.pets || 0) === (lastSearch.pets || 0) &&
    (currentSearch.remember?.trim() || "") ===
      (lastSearch.remember?.trim() || "");

  const place = useMemo(
    () => placeFromHistory(lastSearch, views),
    [lastSearch, views],
  );

  const basedOnKey = lastSearch
    ? [
        lastSearch.where ?? "",
        lastSearch.checkIn ?? "",
        lastSearch.checkOut ?? "",
        lastSearch.guests ?? 0,
        lastSearch.pets ?? 0,
      ].join("|")
    : "";

  const stayInKey = (() => {
    if (!place) return "";
    if (
      lastSearch?.where?.trim() &&
      place.toLowerCase() === lastSearch.where.trim().toLowerCase()
    ) {
      return ""; // skip duplicate of "based on"
    }
    return place;
  })();

  useEffect(() => {
    if (!basedOnKey || !lastSearch) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (lastSearch.where) params.set("where", lastSearch.where);
    // A saved search can be from last month: drop dates that have passed
    // (the API rejects them) and show stays for the place instead.
    if (checkSearchDates(lastSearch.checkIn, lastSearch.checkOut).ok) {
      if (lastSearch.checkIn) params.set("checkIn", lastSearch.checkIn);
      if (lastSearch.checkOut) params.set("checkOut", lastSearch.checkOut);
    }
    // The API 400s junk guests/pets: only send plain whole numbers.
    const g = plainWholeNumber(lastSearch.guests);
    if (g != null && g >= 1) params.set("guests", String(g));
    const pt = plainWholeNumber(lastSearch.pets);
    if (pt != null && pt >= 1 && pt <= SEARCH_MAX_PETS) {
      params.set("pets", String(pt));
    }
    params.set("take", "12");

    fetch(`/api/marketplace/stays?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { listings?: ApiListing[] } | null) => {
        if (cancelled) return;
        setBasedOnPack({
          key: basedOnKey,
          items: data?.listings ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setBasedOnPack({ key: basedOnKey, items: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [basedOnKey, lastSearch]);

  useEffect(() => {
    if (!stayInKey) return;
    let cancelled = false;
    const params = new URLSearchParams({
      where: stayInKey,
      take: "12",
    });
    fetch(`/api/marketplace/stays?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { listings?: ApiListing[] } | null) => {
        if (cancelled) return;
        setStayInPack({
          key: stayInKey,
          items: data?.listings ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setStayInPack({ key: stayInKey, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [stayInKey]);

  const basedOn =
    basedOnPack.key === basedOnKey ? basedOnPack.items : [];
  const stayIn = stayInPack.key === stayInKey ? stayInPack.items : [];

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
                imageAlt={listingPhotoAlt(v.title, null, 0)}
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
