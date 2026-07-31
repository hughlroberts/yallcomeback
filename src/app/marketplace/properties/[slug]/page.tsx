import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookingWidget } from "@/components/booking-widget";

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
import { formatMoney, parseAmenities } from "@/lib/utils";
import { AmenitiesDisplay } from "@/components/amenities-display";
import { SleepingArrangementsDisplay } from "@/components/sleeping-arrangements-display";
import { ListingLocationMap } from "@/components/listing-location-map";
import { ListingShareSave } from "@/components/listing-share-save";
import { MeetYourHost } from "@/components/meet-your-host";
import { ThingsToKnow } from "@/components/things-to-know";
import { TrackRecentlyViewed } from "@/components/track-browse-history";

export const dynamic = "force-dynamic";

export default async function MarketplacePropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    host?: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pets?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const marketplaceWhere = marketplacePropertyWhere();
  const include = {
    images: { orderBy: [{ isCover: "desc" as const }, { sortOrder: "asc" as const }] },
    seasons: { orderBy: { startDate: "asc" as const } },
    location: true,
    host: {
      include: {
        taxLines: {
          where: { active: true },
          orderBy: { sortOrder: "asc" as const },
        },
        _count: {
          select: {
            properties: { where: { published: true } },
          },
        },
      },
    },
  };

  let property = await prisma.property.findFirst({
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

  if (!property) notFound();

  const [ranges, staysHosted] = await Promise.all([
    getPublicUnavailableRanges(property.id),
    prisma.booking.count({
      where: {
        property: { hostId: property.hostId },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    }),
  ]);
  const blockedDates = Array.from(expandBlockedDates(ranges));
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

  return (
    <div>
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
      <div className="relative h-[38vh] min-h-[240px] overflow-hidden bg-stone-900 md:h-[44vh]">
        {cover ? (
          <Image
            src={cover}
            alt=""
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

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/marketplace"
            className="text-stone-500 hover:text-stone-800"
          >
            Stays
          </Link>
          <span className="text-stone-300">/</span>
          <span className="font-medium text-stone-800 line-clamp-1">
            {property.title}
          </span>
        </div>

        {/* Title row - Share + Save top-right like Airbnb */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
            {property.title}
          </h2>
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
          <PhotoGallery photos={property.images} title={property.title} />
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-10">
            <div className="border-b border-stone-200 pb-6">
              <h2 className="text-xl font-semibold text-stone-900">
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
                {property.checkInTime} · checkout {property.checkOutTime}
              </p>
            </div>

            {property.description ? (
              <div>
                <h3 className="text-lg font-semibold text-stone-900">
                  About this place
                </h3>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-stone-600">
                  {property.description}
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

          <div className="lg:sticky lg:top-24 lg:self-start">
            <BookingWidget
              propertySlug={property.slug}
              hostSlug={property.host.slug}
              bookBasePath={`/book/${property.slug}`}
              channel="marketplace"
              baseNightlyRate={property.baseNightlyRate}
              weekendPremiumPercent={property.weekendPremiumPercent}
              discountNewListingPercent={property.discountNewListingPercent}
              discountLastMinutePercent={property.discountLastMinutePercent}
              discountWeeklyPercent={property.discountWeeklyPercent}
              discountMonthlyPercent={property.discountMonthlyPercent}
              defaultMinNights={property.defaultMinNights}
              cleaningFee={property.cleaningFee}
              petFee={property.petFee}
              petFeeUnit={property.petFeeUnit}
              petsAllowed={property.petsAllowed}
              maxPets={property.maxPets}
              depositPercent={property.depositPercent}
              maxGuests={property.maxGuests}
              seasons={property.seasons.map((s) => ({
                name: s.name,
                startDate: s.startDate.toISOString(),
                endDate: s.endDate.toISOString(),
                nightlyRate: s.nightlyRate,
                minNights: s.minNights,
              }))}
              blockedDates={blockedDates}
              initialCheckIn={sp.checkIn}
              initialCheckOut={sp.checkOut}
              initialGuests={
                sp.guests ? Number(sp.guests) || undefined : undefined
              }
              initialPets={sp.pets ? Number(sp.pets) || undefined : undefined}
              taxLiabilityAcknowledged={
                property.host.taxLiabilityAcknowledged
              }
              taxLines={property.host.taxLines.map((t) => ({
                name: t.name,
                ratePercent: t.ratePercent,
                applyToLodging: t.applyToLodging,
                applyToCleaning: t.applyToCleaning,
                applyToPetFee: t.applyToPetFee,
              }))}
            />
          </div>
        </div>

        {/* Full-width bottom stack: map → meet host → things to know */}
        <ListingLocationMap
          className="mt-16 border-t border-stone-200 pt-12"
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
            createdAt: property.host.createdAt,
          }}
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
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map((item) => (
                <PropertyCard
                  key={item.id}
                  property={{
                    ...item,
                    images: item.images ?? [],
                  }}
                  href={`/marketplace/properties/${item.slug}?host=${item.host.slug}`}
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
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
                {disclaimer}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
