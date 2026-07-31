import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertPropertyAccess, ensureHostAccess } from "@/lib/scope";
import {
  listingTypeLabel,
  spaceTypeLabel,
  type SpaceTypeId,
} from "@/lib/listing-types";
import { parseAmenities } from "@/lib/utils";
import { selectedAmenityIds } from "@/lib/listing-amenities";
import { hostSiteHref } from "@/lib/host";
import { ListingWizardSpaceStep } from "@/components/listing-wizard-space-step";
import { ListingWizardLocationStep } from "@/components/listing-wizard-location-step";
import { ListingWizardBasicsStep } from "@/components/listing-wizard-basics-step";
import { ListingWizardAmenitiesStep } from "@/components/listing-wizard-amenities-step";
import { ListingWizardTitleStep } from "@/components/listing-wizard-title-step";
import { ListingWizardDescriptionStep } from "@/components/listing-wizard-description-step";
import { ListingWizardPriceStep } from "@/components/listing-wizard-price-step";
import { ListingWizardDiscountsStep } from "@/components/listing-wizard-discounts-step";
import { ListingWizardPublishStep } from "@/components/listing-wizard-publish-step";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up listing" };

/**
 * Wizard: 2 space · 3 location · 4 basics · 5 amenities · 6 title ·
 * 7 description · 8 prices · 9 discounts · 10 publish · done
 */
export default async function ListingSetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const access = await ensureHostAccess();
  await assertPropertyAccess(id, access);

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      host: { select: { name: true, slug: true } },
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
  });
  if (!property) notFound();

  const stepRaw = sp.step || "2";
  const step = stepRaw === "done" ? "done" : Number(stepRaw);

  if (step === 2) {
    return (
      <ListingWizardSpaceStep
        propertyId={property.id}
        initialSpaceType={property.spaceType as SpaceTypeId}
      />
    );
  }

  if (step === 3) {
    return (
      <ListingWizardLocationStep
        propertyId={property.id}
        initial={{
          address: property.address || "",
          city: property.city || "",
          region: property.region || "",
          country: property.country || "USA",
          postalCode: property.postalCode || "",
          latitude: property.latitude,
          longitude: property.longitude,
          showPreciseLocation: property.showPreciseLocation,
        }}
      />
    );
  }

  if (step === 4) {
    return (
      <ListingWizardBasicsStep
        propertyId={property.id}
        initial={{
          maxGuests: property.maxGuests,
          bedrooms: property.bedrooms,
          beds: property.beds,
          bathrooms: property.bathrooms,
        }}
      />
    );
  }

  if (step === 5) {
    return (
      <ListingWizardAmenitiesStep
        propertyId={property.id}
        initialIds={selectedAmenityIds(parseAmenities(property.amenities))}
      />
    );
  }

  if (step === 6) {
    return (
      <ListingWizardTitleStep
        propertyId={property.id}
        placeWord={listingTypeLabel(property.propertyType)}
        initialTitle={property.title}
      />
    );
  }

  if (step === 7) {
    return (
      <ListingWizardDescriptionStep
        propertyId={property.id}
        initialDescription={property.description || ""}
      />
    );
  }

  if (step === 8) {
    return (
      <ListingWizardPriceStep
        propertyId={property.id}
        initial={{
          baseNightlyRate: property.baseNightlyRate,
          weekendPremiumPercent: property.weekendPremiumPercent,
        }}
      />
    );
  }

  if (step === 9) {
    return (
      <ListingWizardDiscountsStep
        propertyId={property.id}
        initial={{
          discountNewListingPercent: property.discountNewListingPercent,
          discountLastMinutePercent: property.discountLastMinutePercent,
          discountWeeklyPercent: property.discountWeeklyPercent,
          discountMonthlyPercent: property.discountMonthlyPercent,
        }}
      />
    );
  }

  if (step === 10) {
    const publicPath = hostSiteHref(
      property.host.slug,
      `/properties/${property.slug}`,
    );
    return (
      <ListingWizardPublishStep
        propertyId={property.id}
        title={property.title}
        baseNightlyRate={property.baseNightlyRate}
        discountNewListingPercent={property.discountNewListingPercent}
        coverImageUrl={property.images[0]?.url || null}
        previewHref={publicPath}
        editorHref={`/admin/properties/${property.id}`}
        calendarHref={`/admin/properties/${property.id}#calendar`}
      />
    );
  }

  // done (or unknown step after publish)
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonnet text-sm font-bold text-white">
          S
        </span>
        <Link
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          All listings
        </Link>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-14 text-center">
        <p className="text-sm font-medium text-emerald-700">
          {property.published ? "You’re live" : "Draft saved"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-stone-900">
          {property.published
            ? "Your listing is published"
            : property.title}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {listingTypeLabel(property.propertyType)} ·{" "}
          {spaceTypeLabel(property.spaceType)} · ${property.baseNightlyRate}
          /night
          {property.city ? ` · ${property.city}` : ""}
        </p>
        <p className="mt-3 text-stone-600">
          {property.published
            ? "Guests can find it on your host site. Add photos, block dates, and tweak fees anytime."
            : "Finish setup or open the full editor to add photos and publish later."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {property.published ? (
            <Link
              href={hostSiteHref(
                property.host.slug,
                `/properties/${property.slug}`,
              )}
              className="rounded-lg bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              View live listing
            </Link>
          ) : (
            <Link
              href={`/admin/properties/${property.id}/setup?step=10`}
              className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-semibold text-white hover:bg-bonnet-hover"
            >
              Go to publish
            </Link>
          )}
          <Link
            href={`/admin/properties/${property.id}`}
            className="rounded-lg border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Open listing editor
          </Link>
        </div>
      </main>

      <footer className="border-t border-stone-200">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-full bg-bonnet" />
        </div>
      </footer>
    </div>
  );
}
