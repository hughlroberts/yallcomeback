import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import { listingTypeLabel } from "@/lib/listing-types";
import { duplicateProperty } from "@/app/actions/properties";

export const dynamic = "force-dynamic";
export const metadata = { title: "Properties · Admin" };

export default async function AdminPropertiesPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/properties");

  const properties = await prisma.property.findMany({
    where: propertyScopeWhere(access),
    include: {
      images: { take: 1, orderBy: { sortOrder: "asc" } },
      host: { select: { name: true, slug: true } },
      _count: { select: { bookings: true, calendarBlocks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
            Properties
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create listings step by step, then edit anytime. Duplicate to spin up
            a similar stay quickly.
          </p>
        </div>
        <Link
          href="/admin/properties/new"
          className="rounded-[var(--radius-control)] bg-bonnet px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-bonnet-hover"
        >
          Create a new listing
        </Link>
      </div>

      <div className="space-y-3">
        {properties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="font-medium text-slate-900">No listings yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Start with what kind of place you have - photos and the rest come
              next.
            </p>
            <Link
              href="/admin/properties/new"
              className="mt-5 inline-flex rounded-xl bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              Create a new listing
            </Link>
          </div>
        ) : null}

        {properties.map((p) => {
          const editHref =
            p.title === "Untitled listing"
              ? `/admin/properties/${p.id}/setup?step=2`
              : `/admin/properties/${p.id}`;

          return (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <Link href={editHref} className="min-w-0 flex-1 hover:opacity-90">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{p.title}</span>
                  {!p.published && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-100">
                      Draft
                    </span>
                  )}
                  {p.listOnMarketplace ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-100">
                      Marketplace
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                      Host only
                    </span>
                  )}
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
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  href={`/admin/magnets/${p.id}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Fridge magnet
                </Link>
                <form action={duplicateProperty}>
                  <input type="hidden" name="propertyId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Duplicate
                  </button>
                </form>
                <Link
                  href={editHref}
                  className="rounded-[var(--radius-control)] bg-bonnet px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-bonnet-hover"
                >
                  {p.title === "Untitled listing" ? "Continue setup" : "Edit"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
