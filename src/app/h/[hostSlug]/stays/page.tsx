import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import { PropertyCard } from "@/components/property-card";

export const dynamic = "force-dynamic";

export default async function HostStaysPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host) notFound();

  const base = await hostPublicBasePath(host.slug);

  const properties = await prisma.property.findMany({
    where: { hostId: host.id, published: true },
    include: {
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
      host: { select: { name: true, slug: true } },
    },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand,#2563eb)]">
        Stays
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
        Places to stay with {host.name}
      </h1>
      <p className="mt-3 max-w-2xl text-stone-600">
        Book direct — you&apos;re a guest of {host.name}, not a marketplace
        middleman.
      </p>

      {properties.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
          <p className="text-stone-600">No published stays yet.</p>
          {host.sitePageAbout ? (
            <p className="mt-2 text-sm text-stone-500">
              Questions?{" "}
              <Link
                href={`${base}/about#contact`}
                className="font-semibold text-[var(--color-brand)] hover:underline"
              >
                Contact {host.name}
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              href={`${base}/properties/${p.slug}`}
              showHost={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
