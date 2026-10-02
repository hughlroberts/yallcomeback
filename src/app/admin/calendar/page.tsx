import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { propertyScopeWhere } from "@/lib/scope";
import {
  canCreateListings,
  resolveHostAccessInfo,
} from "@/lib/host-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar · Admin" };

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/calendar");

  const properties = await prisma.property.findMany({
    where: propertyScopeWhere(access),
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  if (properties.length === 0) {
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

  const wanted = (await searchParams).property;
  const id = properties.some((p) => p.id === wanted)
    ? wanted!
    : properties[0]!.id;
  redirect(`/admin/properties/${id}?tab=calendar`);
}
