import { computeBookingQuote, initialPetCount } from "@/lib/booking-quote";
import { bookingBarStateFromQuote } from "@/lib/booking-bar-state";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookingWidget } from "@/components/booking-widget";
import { clampGuests } from "@/lib/extra-guests";
import { isValidYmd, nightsBetweenYmd } from "@/lib/search-dates";
import { hostTodayYmd } from "@/lib/host-today";
import { MobileReserveBar } from "@/components/mobile-reserve-bar";

import { PhotoGallery } from "@/components/photo-gallery";
import { PropertyCard } from "@/components/property-card";
import { prisma } from "@/lib/db";
import {
  expandBlockedDates,
  getPublicUnavailableRanges,
} from "@/lib/availability";
import {
  getNearbyMarketplaceListings,
  marketplacePropertyWhere,
} from "@/lib/host";
import { resolveDisclaimer } from "@/lib/pricing";
import { formatMoney, formatTime12h, parseAmenities } from "@/lib/utils";
import { AmenitiesDisplay } from "@/components/amenities-display";
import { SleepingArrangementsDisplay } from "@/components/sleeping-arrangements-display";
import { ListingLocationMap } from "@/components/listing-location-map";
import { ListingShareSave } from "@/components/listing-share-save";
import { MeetYourHost } from "@/components/meet-your-host";
import { ThingsToKnow } from "@/components/things-to-know";
import { TrackRecentlyViewed } from "@/components/track-browse-history";
import { TrackListingView } from "@/components/track-listing-view";
import { ListingJsonLd } from "@/components/listing-json-ld";
import { getSiteOrigin } from "@/lib/site-url";
import { listingCanonicalPath, marketplaceListingHref } from "@/lib/site-url";
import { ambiguousMarketplaceSlugs } from "@/lib/marketplace-slugs";
import { getRequestTenant } from "@/lib/tenant";
import {
  guestDepositDueNow,
  guestPaymentOptions,
  resolveBookingChannel,
} from "@/lib/host-payments";
import { pageMetadata } from "@/lib/seo";
import { listingPhotoAlt } from "@/lib/listing-photo-alt";
import { listingMetaDescription } from "@/lib/listing-meta-description";
import { publicListingText } from "@/lib/listing-public-text";
import { ListingUnavailable } from "@/components/listing-unavailable";
import {
  LISTING_UNAVAILABLE_TITLE,
  brandListingsHidden,
  canPreviewBrand,
  findHiddenBrandListing,
  findPausedListing,
  hiddenFromViewer,
  pausedListingAccess,
  pausedPreviewTitle,
} from "@/lib/brand-visibility";
import { PausedListingBanner } from "@/components/paused-listing-banner";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ host?: string; via?: string; preview?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const marketplaceWhere = marketplacePropertyWhere();

  const property = await prisma.property.findFirst({
    where: {
      slug,
      ...(sp.via === "host_site" && sp.host
        ? {
            published: true,
            host: { slug: sp.host, active: true },
          }
        : {
            published: marketplaceWhere.published,
            listOnMarketplace: marketplaceWhere.listOnMarketplace,
            host: {
              ...marketplaceWhere.host,
              ...(sp.host ? { slug: sp.host } : {}),
            },
          }),
    },
    select: {
      title: true,
      tagline: true,
      description: true,
      city: true,
      region: true,
      slug: true,
      maxGuests: true,
      beds: true,
      bedrooms: true,
      host: {
        select: {
          name: true,
          slug: true,
          hostingMode: true,
          marketplaceSuspendedAt: true,
        },
      },
      images: {
        orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }],
        take: 1,
        select: { url: true, alt: true },
      },
    },
  });

  // T59: the owner's paused preview gets the listing's own title.
  if (!property) {
    const paused = await pausedListingAccess(slug, sp.host, sp.preview);
    if (paused?.kind === "preview") {
      const row = await prisma.property.findFirst({
        where: { id: paused.id },
        select: { title: true },
      });
      const name = row?.title?.trim() || "Your listing";
      return pageMetadata({
        title: pausedPreviewTitle(name),
        description: "Paused, not visible to guests.",
        path: `/marketplace/properties/${encodeURIComponent(slug)}`,
        noIndex: true,
      });
    }
  }

  if (
    brandListingsHidden(property?.host) ||
    (!property && (await findHiddenBrandListing(slug, sp.host))) ||
    (!property && (await findPausedListing(slug, sp.host)))
  ) {
    return pageMetadata({
      title: LISTING_UNAVAILABLE_TITLE,
      description: "Find another place to stay on Yall Come Back.",
      path: `/marketplace/properties/${encodeURIComponent(slug)}`,
      noIndex: true,
    });
  }

  if (!property) {
    return pageMetadata({
      title: "Listing",
      description: "Stay again with a host you know on Yall Come Back.",
      path: `/marketplace/properties/${encodeURIComponent(slug)}`,
      noIndex: true,
    });
  }

  const description = listingMetaDescription({
    title: property.title,
    tagline: property.tagline,
    description: publicListingText(property.description),
    city: property.city,
    region: property.region,
    maxGuests: property.maxGuests,
    beds: property.beds,
    bedrooms: property.bedrooms,
    hostName: property.host.name,
  });
  const cover = property.images[0];
  // Canonical/og:url carry no query string (no ?host=).
  const path = listingCanonicalPath(property.slug);

  return pageMetadata({
    title: property.title,
    description,
    path,
    image: cover?.url,
    imageAlt: listingPhotoAlt(property.title, cover?.alt, 0),
  });
}

export default async function MarketplacePropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    host?: string;
    preview?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
    via?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const marketplaceWhere = marketplacePropertyWhere();
  const viaHostSite = sp.via === "host_site";
  const include = {
    images: {
      orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }],
      take: 16,
    },
    seasons: { orderBy: { startDate: "asc" as const } },
    location: true,
    host: {
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        description: true,
        logoUrl: true,
        contactEmail: true,
        contactPhone: true,
        websiteUrl: true,
        sitePresence: true,
        hostingMode: true,
        createdAt: true,
        taxLiabilityAcknowledged: true,
        defaultDisclaimer: true,
        stripeAccountId: true,
        websitePaymentMethod: true,
        marketplaceSuspendedAt: true,
        taxLines: {
          where: { active: true },
          orderBy: { sortOrder: "asc" as const },
          select: {
            name: true,
            ratePercent: true,
            applyToLodging: true,
            applyToCleaning: true,
            applyToPetFee: true,
          },
        },
        _count: {
          select: {
            properties: { where: { published: true } },
          },
        },
      },
    },
  };

  let property =
    viaHostSite && sp.host
      ? await prisma.property.findFirst({
          where: {
            slug,
            published: true,
            host: { slug: sp.host, active: true },
          },
          include,
        })
      : await prisma.property.findFirst({
          where: {
            slug,
            published: marketplaceWhere.published,
            listOnMarketplace: marketplaceWhere.listOnMarketplace,
            host: {
              ...marketplaceWhere.host,
              ...(sp.host ? { slug: sp.host } : {}),
            },
          },
          include,
        });

  // Wrong ?host= (e.g. personal listing linked as Cherokee) → correct URL
  if (!property && sp.host) {
    const bySlug = await prisma.property.findFirst({
      where: {
        slug,
        published: marketplaceWhere.published,
        listOnMarketplace: marketplaceWhere.listOnMarketplace,
        host: marketplaceWhere.host,
      },
      include: { host: { select: { slug: true } } },
    });
    if (bySlug && bySlug.host.slug !== sp.host) {
      const q = new URLSearchParams();
      q.set("host", bySlug.host.slug);
      if (sp.checkIn) q.set("checkIn", sp.checkIn);
      if (sp.checkOut) q.set("checkOut", sp.checkOut);
      if (sp.guests) q.set("guests", sp.guests);
      if (sp.pets) q.set("pets", sp.pets);
      if (sp.via) q.set("via", sp.via);
      redirect(`/marketplace/properties/${slug}?${q.toString()}`);
    }
  }

  // No host param: still resolve a unique marketplace slug
  if (!property && !sp.host) {
    property = await prisma.property.findFirst({
      where: {
        slug,
        published: marketplaceWhere.published,
        listOnMarketplace: marketplaceWhere.listOnMarketplace,
        host: marketplaceWhere.host,
      },
      include,
    });
  }

  const tenant = await getRequestTenant();
  if (!property && tenant) {
    property = await prisma.property.findFirst({
      where: {
        slug,
        published: true,
        hostId: tenant.id,
      },
      include,
    });
  }

  // T46: hidden brand. Direct links show a clean page; host/admin preview.
  if (!property) {
    const hidden = await findHiddenBrandListing(slug, sp.host);
    if (hidden) {
      if (!(await canPreviewBrand(hidden.hostId))) return <ListingUnavailable />;
      property = await prisma.property.findFirst({
        where: { id: hidden.id },
        include,
      });
    }
  } else if (await hiddenFromViewer(property.host)) {
    return <ListingUnavailable />;
  }

  // T58: paused listing. Guests: "not available". Host/admin: preview + banner.
  let pausedPreview = false;
  if (!property) {
    const paused = await pausedListingAccess(slug, sp.host, sp.preview);
    if (paused?.kind === "unavailable") return <ListingUnavailable />;
    if (paused?.kind === "preview") {
      property = await prisma.property.findFirst({
        where: { id: paused.id },
        include,
      });
      pausedPreview = Boolean(property);
    }
  }

  if (!property) notFound();

  const bookingChannel = resolveBookingChannel({
    tenantHostSlug: tenant?.slug,
    listingHostSlug: property.host.slug,
  });
  // Same readiness check as /book: no card/Bitcoin ready → request to book.
  const depositDueNow = guestDepositDueNow(
    guestPaymentOptions(property.host, bookingChannel, property),
  );

  const [ranges, staysHosted, brandOwner] = await Promise.all([
    getPublicUnavailableRanges(property.id),
    prisma.booking.count({
      where: {
        property: { hostId: property.hostId },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    }),
    prisma.user.findFirst({
      where: {
        hostId: property.hostId,
        role: "HOST",
        OR: [{ hostAccess: "OWNER" }, { hostAccess: null }],
      },
      orderBy: { createdAt: "asc" },
      select: { avatarUrl: true },
    }),
  ]);
  const blockedDates = Array.from(expandBlockedDates(ranges));
  const widgetSeasons = property.seasons.map((s) => ({
    name: s.name,
    startDate: s.startDate.toISOString(),
    endDate: s.endDate.toISOString(),
    nightlyRate: s.nightlyRate,
    minNights: s.minNights,
  }));
  const widgetTaxLines = property.host.taxLines.map((t) => ({
    name: t.name,
    ratePercent: t.ratePercent,
    applyToLodging: t.applyToLodging,
    applyToCleaning: t.applyToCleaning,
    applyToPetFee: t.applyToPetFee,
  }));
  const initialPets = sp.pets ? Number(sp.pets) || undefined : undefined;
  // E1104-D3: validate URL prefills like /book — reject impossible dates (no
  // Date rollover), warn on reversed / under-min stays and guest clamps.
  const guestCount = clampGuests(sp.guests, property.maxGuests);
  const prefillNotices: string[] = [];
  const ciRaw = (sp.checkIn ?? "").trim();
  const coRaw = (sp.checkOut ?? "").trim();
  let initialCheckIn = ciRaw;
  let initialCheckOut = coRaw;
  if (ciRaw || coRaw) {
    const ciOk = !ciRaw || isValidYmd(ciRaw);
    const coOk = !coRaw || isValidYmd(coRaw);
    if (!ciOk || !coOk) {
      prefillNotices.push(
        "Those dates don't look right. Pick dates in the calendar.",
      );
      initialCheckIn = "";
      initialCheckOut = "";
    } else if (ciRaw && coRaw) {
      const nights = nightsBetweenYmd(ciRaw, coRaw);
      if (nights < 1) {
        prefillNotices.push(
          "Check-out has to be after check-in (1 night minimum).",
        );
        initialCheckIn = "";
        initialCheckOut = "";
      } else if (nights < property.defaultMinNights) {
        prefillNotices.push(
          `Minimum stay is ${property.defaultMinNights} night${
            property.defaultMinNights === 1 ? "" : "s"
          }. Pick a longer stay or clear the dates.`,
        );
        // Keep dates so the widget quote error matches; guest already warned.
      }
    } else {
      prefillNotices.push(
        "Add both check-in and check-out, or clear the dates.",
      );
      initialCheckIn = "";
      initialCheckOut = "";
    }
  }
  if (guestCount.clamped && guestCount.requested < 1) {
    prefillNotices.push(
      `Guests must be at least 1, so we set guests to ${guestCount.guests}.`,
    );
  } else if (guestCount.clamped && guestCount.requested > guestCount.guests) {
    prefillNotices.push(
      `This place sleeps up to ${property.maxGuests}, so we set guests to ${guestCount.guests}.`,
    );
  }
  // Same quote math as the widget, so the mobile bar's first paint shows dates/total.
  const initialBarState = bookingBarStateFromQuote(
    initialCheckIn,
    initialCheckOut,
    computeBookingQuote({
      checkIn: initialCheckIn,
      checkOut: initialCheckOut,
      pets: initialPetCount(property, initialPets),
      guests: guestCount.guests,
      extraGuestFee: property.extraGuestFee,
      extraGuestsIncluded: property.extraGuestsIncluded,
      baseNightlyRate: property.baseNightlyRate,
      weekendPremiumPercent: property.weekendPremiumPercent,
      discountNewListingPercent: property.discountNewListingPercent,
      discountLastMinutePercent: property.discountLastMinutePercent,
      discountWeeklyPercent: property.discountWeeklyPercent,
      discountMonthlyPercent: property.discountMonthlyPercent,
      defaultMinNights: property.defaultMinNights,
      cleaningFee: property.cleaningFee,
      petFee: property.petFee,
      petFeeUnit: property.petFeeUnit,
      petsAllowed: property.petsAllowed,
      maxPets: property.maxPets,
      depositPercent: property.depositPercent,
      seasons: widgetSeasons,
      blocked: new Set(blockedDates),
      taxLines: widgetTaxLines,
      taxLiabilityAcknowledged: property.host.taxLiabilityAcknowledged,
    }),
  );
  const amenities = parseAmenities(property.amenities);
  const disclaimer = resolveDisclaimer(
    property.disclaimer,
    property.host.defaultDisclaimer,
  );
  const cover = property.images[0]?.url;

  const nearby = await getNearbyMarketplaceListings(
    {
      id: property.id,
      latitude: property.latitude,
      longitude: property.longitude,
      city: property.city,
      region: property.region,
    },
    6,
  );
  // Sibling links use the clean canonical URL unless the slug is shared.
  const ambiguousNearby = await ambiguousMarketplaceSlugs(
    nearby.map((n) => n.slug),
  );

  const origin = await getSiteOrigin();
  const listingUrl = `${origin}${listingCanonicalPath(property.slug)}`;
  const absImages = property.images.map((img) =>
    img.url.startsWith("http") ? img.url : `${origin}${img.url}`,
  );

  // Guest-facing About text: no "Imported from Airbnb" note or source links.
  const aboutText = publicListingText(property.description);

  return (
    <div>
      {pausedPreview ? <PausedListingBanner /> : null}
      {prefillNotices.length > 0 ? (
        <div
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 sm:px-6"
        >
          <div className="mx-auto max-w-6xl space-y-1">
            {prefillNotices.map((msg) => (
              <p key={msg}>{msg}</p>
            ))}
          </div>
        </div>
      ) : null}
      <ListingJsonLd
        origin={origin}
        name={property.title}
        description={aboutText || property.tagline}
        url={listingUrl}
        imageUrls={absImages.slice(0, 8)}
        city={property.city}
        region={property.region}
        country={property.country}
        postalCode={property.postalCode}
        latitude={property.showPreciseLocation ? property.latitude : null}
        longitude={property.showPreciseLocation ? property.longitude : null}
        guests={property.maxGuests}
        bedrooms={property.bedrooms}
        bathrooms={property.bathrooms}
        petsAllowed={property.petsAllowed}
        checkInTime={property.checkInTime}
        checkOutTime={property.checkOutTime}
        priceNightly={property.baseNightlyRate}
        hostName={property.host.name}
      />
      <TrackRecentlyViewed
        id={property.id}
        slug={property.slug}
        hostSlug={property.host.slug}
        title={property.title}
        city={property.city}
        region={property.region}
        baseNightlyRate={property.baseNightlyRate}
        bedrooms={property.bedrooms}
        maxGuests={property.maxGuests}
        imageUrl={property.images[0]?.url ?? null}
      />
      <TrackListingView propertyId={property.id} />

      {/* Early in tree (fixed visually): Tab reaches sticky CTA before #reserve (N2). */}
      <MobileReserveBar
        nightlyRate={property.baseNightlyRate}
        depositDueNow={depositDueNow}
        initialState={initialBarState}
      />
      <div className="relative h-[38vh] min-h-[240px] overflow-hidden bg-stone-900 md:h-[44vh]">
        {cover ? (
          <Image
            src={cover}
            alt={listingPhotoAlt(property.title, property.images[0]?.alt, 0)}
            fill
            className="object-cover opacity-90"
            sizes="100vw"
            priority
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/45 to-stone-900/20" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-8 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200/90">
            Marketplace
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            {property.title}
          </h1>
          <p className="mt-3 text-lg text-stone-200">
            {[property.city, property.region].filter(Boolean).join(", ")}
            {property.host.name ? ` · Hosted by ${property.host.name}` : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:pb-8">
        {/* Title lives in the hero only — breadcrumb + share/save here */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <Link
              href="/marketplace"
              className={`inline-flex min-h-6 items-center text-stone-500 hover:text-stone-800 ${PRIMARY_CTA_FOCUS_CLASS}`}
            >
              Stays
            </Link>
            <span className="text-stone-400" aria-hidden="true">/</span>
            <span className="font-medium text-stone-800 line-clamp-1">
              {property.title}
            </span>
          </div>
          <ListingShareSave
            title={property.title}
            listing={{
              id: property.id,
              slug: property.slug,
              hostSlug: property.host.slug,
              title: property.title,
              city: property.city,
              region: property.region,
              baseNightlyRate: property.baseNightlyRate,
              bedrooms: property.bedrooms,
              maxGuests: property.maxGuests,
              imageUrl: property.images[0]?.url ?? null,
            }}
          />
        </div>

        <div>
          <PhotoGallery
            photos={property.images}
            title={property.title}
            coverPriority={false}
          />
        </div>

        {/*
          Desktop (lg+): details on the left, sticky reserve sidebar on the right.
          Under lg the details wrapper is display:contents, so the summary,
          the reserve widget, and "About this place" stack in that order.
          The widget renders once (one #reserve, one form) at every width.
        */}
        <div
          data-testid="listing-detail-grid"
          className="mt-8 grid grid-cols-1 gap-8 lg:mt-10 lg:grid-cols-[1fr_380px] lg:items-start lg:gap-10"
        >
          <div className="contents lg:block lg:min-w-0 lg:space-y-10">
            <div
              data-testid="listing-summary"
              className="order-1 min-w-0 border-b border-stone-200 pb-5 sm:pb-6 lg:order-none"
            >
              <h2 className="text-lg font-semibold text-stone-900 sm:text-xl">
                Entire home · {property.maxGuests} guests · {property.bedrooms}{" "}
                bedroom{property.bedrooms === 1 ? "" : "s"} ·{" "}
                {property.bathrooms} bath
              </h2>
              {property.tagline ? (
                <p className="mt-2 text-stone-600">{property.tagline}</p>
              ) : null}
              <p className="mt-2 text-sm text-stone-500">
                From {formatMoney(property.baseNightlyRate)} / night · min{" "}
                {property.defaultMinNights} nights · check-in{" "}
                {formatTime12h(property.checkInTime)} · checkout{" "}
                {formatTime12h(property.checkOutTime)}
              </p>
            </div>

            <div
              data-testid="listing-details"
              className="order-3 min-w-0 space-y-8 sm:space-y-10 lg:order-none"
            >
              {aboutText ? (
                <div>
                  <h3 className="text-lg font-semibold text-stone-900">
                    About this place
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed text-stone-600">
                    {aboutText}
                  </p>
                </div>
              ) : null}

              <SleepingArrangementsDisplay
                rawJson={property.sleepingArrangements}
                bedrooms={property.bedrooms}
                beds={property.beds}
              />

              <AmenitiesDisplay amenities={amenities} />
            </div>
          </div>

          <div
            data-testid="listing-reserve-column"
            className="order-2 min-w-0 lg:order-none lg:sticky lg:top-[calc(var(--site-header-h,calc(5.5rem+1px))+1.5rem)] lg:self-start"
          >
            <BookingWidget
              propertySlug={property.slug}
              hostSlug={property.host.slug}
              bookBasePath={`/book/${property.slug}`}
              channel={bookingChannel}
              depositDueNow={depositDueNow}
              baseNightlyRate={property.baseNightlyRate}
              weekendPremiumPercent={property.weekendPremiumPercent}
              discountNewListingPercent={property.discountNewListingPercent}
              discountLastMinutePercent={property.discountLastMinutePercent}
              discountWeeklyPercent={property.discountWeeklyPercent}
              discountMonthlyPercent={property.discountMonthlyPercent}
              defaultMinNights={property.defaultMinNights}
              cleaningFee={property.cleaningFee}
              extraGuestFee={property.extraGuestFee}
              extraGuestsIncluded={property.extraGuestsIncluded}
              todayYmd={hostTodayYmd()}
              petFee={property.petFee}
              petFeeUnit={property.petFeeUnit}
              petsAllowed={property.petsAllowed}
              maxPets={property.maxPets}
              depositPercent={property.depositPercent}
              maxGuests={property.maxGuests}
              seasons={widgetSeasons}
              blockedDates={blockedDates}
              initialCheckIn={initialCheckIn || undefined}
              initialCheckOut={initialCheckOut || undefined}
              initialGuests={guestCount.guests}
              initialPets={initialPets}
              taxLiabilityAcknowledged={property.host.taxLiabilityAcknowledged}
              taxLines={widgetTaxLines}
            />
          </div>
        </div>


        {/* Full-width bottom stack: map → meet host → things to know */}
        <ListingLocationMap
          className="mt-10 border-t border-stone-200 pt-8"
          latitude={property.latitude}
          longitude={property.longitude}
          showPreciseLocation={property.showPreciseLocation}
          city={property.city}
          region={property.region}
          country={property.country}
          areaLabel={
            property.location?.name || property.host.name || property.city
          }
        />

        <MeetYourHost
          className="mt-16 border-t border-stone-200 pt-12"
          host={{
            name: property.host.name,
            tagline: property.host.tagline,
            description: property.host.description,
            logoUrl: property.host.logoUrl,
            contactEmail: property.host.contactEmail,
            contactPhone: property.host.contactPhone,
            websiteUrl: property.host.websiteUrl,
            sitePresence: property.host.sitePresence,
            hostingMode: property.host.hostingMode,
          }}
          profileAvatarUrl={brandOwner?.avatarUrl}
          staysHosted={staysHosted}
          listingCount={property.host._count.properties}
          propertyId={property.id}
          propertyTitle={property.title}
        />

        <ThingsToKnow
          className="mt-16 border-t border-stone-200 pt-12"
          checkInTime={property.checkInTime}
          checkOutTime={property.checkOutTime}
          maxGuests={property.maxGuests}
          houseRules={property.houseRules}
          petsAllowed={property.petsAllowed}
          maxPets={property.maxPets}
          amenities={amenities}
          datesHref="#reserve"
          cancellationPolicy={property.cancellationPolicy}
          longTermCancellationPolicy={property.longTermCancellationPolicy}
          nonRefundableOption={property.nonRefundableOption}
        />

        {nearby.length > 0 ? (
          <section className="mt-16 border-t border-stone-200 pt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-stone-900">
                  More places nearby
                </h2>
                <p className="mt-1 text-sm text-stone-500">
                  {property.latitude != null && property.longitude != null
                    ? "Sorted by miles on the map - closest first."
                    : property.city
                      ? `Other stays near ${property.city}${
                          property.region ? `, ${property.region}` : ""
                        }.`
                      : "Other marketplace stays you might like."}
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 sm:mt-8 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
              {nearby.map((item) => (
                <PropertyCard
                  key={item.id}
                  property={{
                    ...item,
                    images: item.images ?? [],
                  }}
                  href={marketplaceListingHref(
                    item.slug,
                    item.host.slug,
                    ambiguousNearby,
                  )}
                  showHost
                  distanceLabel={item.distanceLabel}
                />
              ))}
            </div>
          </section>
        ) : null}

        {disclaimer ? (
          <div className="mt-16 border-t border-stone-200 pt-12">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h3 className="text-lg font-semibold text-stone-900">
                Important disclaimer
              </h3>
              <p className="mt-3 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-stone-700">
                {disclaimer}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
