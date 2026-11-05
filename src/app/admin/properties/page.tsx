import { ListingLinkPair } from "@/components/listing-link-pair";
import { listingStatusBadgeClass, listingStatusLabel } from "@/lib/listing-status-label";
import { PRIVATE_PREVIEW_LABEL } from "@/lib/private-preview-label";
import { marketplaceListingHref } from "@/lib/marketplace-links";
import { pausedPreviewHref } from "@/lib/listing-preview-token";
import Link from "next/link";
import { listingDisplayTitle } from "@/lib/listing-display-title";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import { listingTypeLabel } from "@/lib/listing-types";
import { duplicateProperty } from "@/app/actions/properties";
import {
  canCreateListings,
  canDeleteListings,
  resolveHostAccessInfo,
} from "@/lib/host-access";
import { ListingVisibilityForm } from "@/components/listing-visibility-form";
import { ListingLifecycleActions } from "@/components/listing-lifecycle-actions";
import {
  visibilityFromFlags,
} from "@/lib/listing-visibility";
import { cn } from "@/lib/utils";
import { viewerCanPublishListings } from "@/lib/email-verified";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";

export const dynamic = "force-dynamic";
export const metadata = { title: "Listings · Admin" };

export default async function AdminPropertiesPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/properties");

  const accessInfo = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  const allowCreate = canCreateListings(accessInfo);
  const allowRemove = canDeleteListings(accessInfo);
  let hostingAllowsCreate = true;
  if (access.hostId && !access.isPlatform) {
    const { canHostAddFutureWork } = await import("@/lib/hosting");
    const host = await prisma.host.findUnique({
      where: { id: access.hostId },
      select: {
        active: true,
        hostingMode: true,
        approvalStatus: true,
        subscriptionStatus: true,
      },
    });
    hostingAllowsCreate = host ? canHostAddFutureWork(host) : false;
  }
  const showCreate = allowCreate && hostingAllowsCreate;
  const emailVerified = await viewerCanPublishListings({
    userId: access.session.user.id,
    bypass: access.isPlatform,
  });

  const allProperties = await prisma.property.findMany({
    where: propertyScopeWhere(access),
    include: {
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      host: { select: { name: true, slug: true, listOnMarketplace: true } },
      _count: { select: { bookings: true, calendarBlocks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const properties = allProperties.filter((p) => !p.archivedAt);
  const archived = allProperties.filter((p) => p.archivedAt);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
            Listings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {showCreate
              ? "Turn bookings on or off per stay. Off means guests cannot book on your website or Find a Place."
              : hostingAllowsCreate
                ? "Update calendars, photos, and details. Creating new listings requires full co-host access."
                : "Hosting is paused for new listings. You can still edit existing stays. Pay hosting under Subscription to add more."}
          </p>
        </div>
        {showCreate ? (
          <Link
            href="/admin/properties/new"
            className={`rounded-[var(--radius-control)] bg-bonnet px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bonnet-hover ${PRIMARY_CTA_FOCUS_CLASS}`}
          >
            Create / import listing
          </Link>
        ) : null}
      </div>

      <div className="space-y-3">
        {properties.length === 0 && archived.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="font-medium text-slate-900">No listings yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Start with what kind of place you have - photos and the rest come
              next.
            </p>
            {showCreate ? (
            <Link
              href="/admin/properties/new"
              className={`mt-5 inline-flex rounded-xl bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover ${PRIMARY_CTA_FOCUS_CLASS}`}
            >
              Create a new listing
            </Link>
            ) : null}
          </div>
        ) : null}

        {properties.map((p) => {
          const editHref =
            p.title === "Untitled listing"
              ? `/admin/properties/${p.id}/setup?step=2`
              : `/admin/properties/${p.id}`;
          const calendarHref = `/admin/calendar?property=${p.id}`;
          const primaryHref = editHref;
          const vis = visibilityFromFlags(p.published, p.listOnMarketplace);
          // T58: public links on the row; paused rows use the signed host preview.
          const rowFindAPlaceHref =
            vis === "off"
              ? pausedPreviewHref(p.slug, p.host.slug, p.id)
              : marketplaceListingHref(p.slug, p.host.slug);
          const rowToken = vis === "off" ? new URL(rowFindAPlaceHref, "http://x").searchParams.get("preview") : null;
          const rowWebsiteHref =
            `/h/${encodeURIComponent(p.host.slug)}/properties/${encodeURIComponent(p.slug)}` +
            (rowToken ? `?preview=${encodeURIComponent(rowToken)}` : "");

          return (
            <div
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <Link href={primaryHref} className="min-w-0 flex-1 hover:opacity-90">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">
                    {listingDisplayTitle(p)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      listingStatusBadgeClass(p),
                    )}
                  >
                    {listingStatusLabel(p)}
                  </span>
                  {p.featured && (
                    <span className="rounded-full bg-petal px-2.5 py-0.5 text-xs font-semibold text-bonnet ring-1 ring-inset ring-petal">
                      Featured
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {access.isPlatform ? `${p.host.name} · ` : ""}
                  {listingTypeLabel(p.propertyType)} · {p.city || "No city"} ·{" "}
                  {formatMoney(p.baseNightlyRate)}/night · {p._count.bookings}{" "}
                  bookings
                </p>
              </Link>
              {p.title === "Untitled listing" ? null : (
                <p className="w-full text-xs text-slate-400" data-testid="row-public-links">
                  {vis === "off" ? `Paused, ${PRIVATE_PREVIEW_LABEL.toLowerCase()}: ` : null}
                  {vis === "website" || vis === "both" || vis === "off" ? (
                    <>
                      Website:{" "}
                      <ListingLinkPair href={rowWebsiteHref} testId="row-website-link">
                        /h/{p.host.slug}/properties/{p.slug}
                      </ListingLinkPair>
                    </>
                  ) : null}
                  {vis === "both" || vis === "off" ? (
                    <>
                      <span className="mx-1.5 text-slate-300">·</span>
                      Find a Place:{" "}
                      <ListingLinkPair href={rowFindAPlaceHref} testId="row-find-a-place-link">
                        /marketplace/properties/{p.slug}
                      </ListingLinkPair>
                    </>
                  ) : null}
                </p>
              )}
              <div className="flex w-full min-w-0 flex-wrap items-end gap-2 sm:w-auto">
                <ListingVisibilityForm
                  propertyId={p.id}
                  published={p.published}
                  listOnMarketplace={p.listOnMarketplace}
                  hostMarketplaceOn={p.host.listOnMarketplace}
                  compact
                  emailVerified={emailVerified}
                />
                {p.title === "Untitled listing" ? null : (
                  <Link
                    href={calendarHref}
                    className={`rounded-[var(--radius-control)] bg-bonnet px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-bonnet-hover ${PRIMARY_CTA_FOCUS_CLASS}`}
                  >
                    Calendar
                  </Link>
                )}
                <Link
                  href={`/admin/magnets/${p.id}`}
                  className={`rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 ${PRIMARY_CTA_FOCUS_CLASS}`}
                >
                  Fridge magnet
                </Link>
                <ListingLifecycleActions
                  propertyId={p.id}
                  title={listingDisplayTitle(p)}
                  published={p.published}
                  archived={false}
                  canRemove={allowRemove}
                />
                {showCreate ? (
                  <form action={duplicateProperty}>
                    <input type="hidden" name="propertyId" value={p.id} />
                    <button
                      type="submit"
                      className={`rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 ${PRIMARY_CTA_FOCUS_CLASS}`}
                    >
                      Duplicate
                    </button>
                  </form>
                ) : null}
                <Link
                  href={editHref}
                  className={`rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 ${PRIMARY_CTA_FOCUS_CLASS}`}
                >
                  {p.title === "Untitled listing" ? "Continue setup" : "Edit listing"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-listings" className="mt-10">
          <h2
            id="archived-listings"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            Archived ({archived.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Guests cannot find or book these listings. Restore a listing to
            move it back as paused.
          </p>
          <div className="mt-3 space-y-3">
            {archived.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4"
              >
                <Link
                  href={`/admin/properties/${p.id}`}
                  className="min-w-0 flex-1 hover:opacity-90"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      {listingDisplayTitle(p)}
                    </span>
                    <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
                      Archived
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {access.isPlatform ? `${p.host.name} · ` : ""}
                    {listingTypeLabel(p.propertyType)} · {p.city || "No city"} ·{" "}
                    {p._count.bookings} bookings
                  </p>
                </Link>
                <ListingLifecycleActions
                  propertyId={p.id}
                  title={listingDisplayTitle(p)}
                  published={false}
                  archived
                  canRemove={allowRemove}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
