import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import {
  canCreateListings,
  resolveHostAccessInfo,
} from "@/lib/host-access";
import { AdminListingSwitcher } from "@/components/admin-listing-switcher";
import { AdminListingWorkspace } from "@/components/admin-listing-workspace";
import { viewerCanPublishListings } from "@/lib/email-verified";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · Admin" };

function toYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/calendar");

  const listings = await prisma.property.findMany({
    where: propertyScopeWhere(access),
    select: {
      id: true,
      title: true,
      published: true,
      listOnMarketplace: true,
      images: {
        take: 1,
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        select: { url: true },
      },
    },
    orderBy: { title: "asc" },
  });

  if (listings.length === 0) {
    const accessInfo = resolveHostAccessInfo({
      isPlatform: access.isPlatform,
      hostId: access.hostId,
      hostAccess: access.hostAccess,
    });
    const allowCreate = canCreateListings(accessInfo);
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
        <h1 className="text-xl font-semibold text-stone-900">Calendar</h1>
        <p className="mt-2 text-sm text-stone-500">
          Add a stay, then this page is where you price nights, block dates, and
          see Airbnb or VRBO as busy.
        </p>
        {allowCreate ? (
          <Link
            href="/admin/properties/new"
            className="mt-6 inline-flex rounded-xl bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
          >
            Create a listing
          </Link>
        ) : null}
      </div>
    );
  }

  const sp = await searchParams;
  const wanted = sp.property;
  const activeId = listings.some((p) => p.id === wanted)
    ? wanted!
    : listings[0]!.id;

  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);

  const property = await prisma.property.findFirst({
    where: { id: activeId, ...propertyScopeWhere(access) },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      seasons: { orderBy: { startDate: "asc" } },
      calendarBlocks: {
        where: { endDate: { gte: since } },
        orderBy: { startDate: "asc" },
        take: 400,
        include: { connection: { select: { name: true } } },
      },
      host: {
        select: { slug: true, listOnMarketplace: true },
      },
      bookings: {
        where: {
          status: { in: ["CONFIRMED", "PENDING_PAYMENT", "COMPLETED"] },
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
          status: true,
          guestName: true,
          guests: true,
        },
        take: 500,
      },
    },
  });
  if (!property) redirect("/admin/calendar");

  const emailVerified = await viewerCanPublishListings({
    userId: access.session.user.id,
    bypass: access.isPlatform,
  });

  return (
    <div className="-mx-4 -my-8 flex min-h-[calc(100vh-8rem)] flex-col border-t border-slate-200/80 bg-[var(--background)] sm:-mx-6 lg:flex-row lg:items-start">
      <div className="shrink-0 border-b border-slate-200/80 px-4 py-3 sm:px-5 lg:sticky lg:top-3 lg:z-10 lg:w-64 lg:self-start lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-3 lg:py-5">
        <AdminListingSwitcher
          stackFrom="lg"
          listings={listings.map((p) => ({
            id: p.id,
            title: p.title,
            published: p.published,
            listOnMarketplace: p.listOnMarketplace,
            coverUrl: p.images[0]?.url || null,
          }))}
          activeId={property.id}
        />
      </div>
      <div className="min-w-0 flex-1 bg-white px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AdminListingWorkspace
          calendarOnly
          emailVerified={emailVerified}
          property={{
            id: property.id,
            title: property.title,
            slug: property.slug,
            hostSlug: property.host.slug,
            published: property.published,
            listOnMarketplace: property.listOnMarketplace,
            hostMarketplaceOn: property.host.listOnMarketplace,
            city: property.city,
            region: property.region,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            maxGuests: property.maxGuests,
            baseNightlyRate: property.baseNightlyRate,
            weekendPremiumPercent: property.weekendPremiumPercent,
            cleaningFee: property.cleaningFee,
            petFee: property.petFee,
            petFeeUnit: property.petFeeUnit,
            petsAllowed: property.petsAllowed,
            maxPets: property.maxPets,
            defaultMinNights: property.defaultMinNights,
            images: property.images.map((img) => ({
              id: img.id,
              url: img.url,
              alt: img.alt,
              sortOrder: img.sortOrder,
              isCover: img.isCover,
            })),
          }}
          seasons={property.seasons.map((s) => ({
            id: s.id,
            name: s.name,
            startDate: toYmd(s.startDate),
            endDate: toYmd(s.endDate),
            nightlyRate: s.nightlyRate,
            minNights: s.minNights,
            holidayKey: s.holidayKey,
          }))}
          blocks={property.calendarBlocks.map((b) => ({
            id: b.id,
            startDate: toYmd(b.startDate),
            endDate: toYmd(b.endDate),
            occupantName: b.occupantName,
            guestCount: b.guestCount,
            blockType: b.blockType,
            source: b.source,
            connectionName: b.connection?.name || null,
          }))}
          bookings={property.bookings.map((b) => ({
            id: b.id,
            checkIn: toYmd(b.checkIn),
            checkOut: toYmd(b.checkOut),
            status: b.status,
            guestName: b.guestName,
            guests: b.guests,
          }))}
        />
      </div>
    </div>
  );
}
