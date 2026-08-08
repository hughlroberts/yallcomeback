import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import {
  hostServicesPageLabel,
  hostSiteNavItems,
} from "@/lib/host-site";
import { PropertyCard } from "@/components/property-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Host-owned home — hero + stays below banner, optional About teaser.
 * Page links are separate routes under the sticky site header.
 */
export default async function HostSiteHomePage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host) notFound();

  const base = await hostPublicBasePath(host.slug);

  const properties = await prisma.property.findMany({
    where: {
      hostId: host.id,
      published: true,
    },
    include: {
      images: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
      host: { select: { name: true, slug: true } },
    },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
  });

  const cover = properties[0]?.images[0]?.url || "/seed/hero/home.jpg";

  // Hero CTAs = the same page links (Book + Stays + optional About + Services)
  const pageButtons = hostSiteNavItems(host, base);
  const servicesLabel = hostServicesPageLabel(host);

  return (
    <div>
      <section className="relative min-h-[52vh] overflow-hidden bg-stone-900 sm:min-h-[58vh]">
        <Image
          src={cover}
          alt=""
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/55 to-stone-900/30" />
        <div className="relative z-10 mx-auto flex min-h-[52vh] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 sm:min-h-[58vh] sm:px-6 sm:pb-16">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/80">
            Book direct
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium tracking-tight text-white sm:text-5xl">
            {host.name}
          </h1>
          {host.tagline ? (
            <p className="mt-3 max-w-2xl text-lg text-stone-200">
              {host.tagline}
            </p>
          ) : (
            <p className="mt-3 max-w-2xl text-lg text-stone-200">
              Stay with us — book direct, no marketplace middleman.
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-2.5 sm:gap-3">
            {pageButtons.map((item) => {
              const isBook = item.primary;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-5 py-2.5 text-sm font-semibold transition",
                    isBook
                      ? "bg-white text-stone-900 hover:bg-stone-100"
                      : "border border-white/30 bg-white/10 text-white hover:bg-white/15",
                  )}
                >
                  {item.label === "Book"
                    ? "Book"
                    : item.label === "Stays"
                      ? "Stays"
                      : item.label === "About"
                        ? "About"
                        : item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stays section below the banner (home overview) */}
      <section
        id="stays"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:px-6"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900 sm:text-3xl">
              Our stays
            </h2>
            <p className="mt-2 text-stone-500">
              Reserve direct with {host.name}
            </p>
          </div>
          {properties.length > 0 ? (
            <Link
              href={`${base}/stays`}
              className="text-sm font-semibold text-[var(--color-brand,#2563eb)] hover:underline"
            >
              See all →
            </Link>
          ) : null}
        </div>

        {properties.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center">
            <p className="text-stone-600">
              Listings are being prepared. Check back soon
              {host.sitePageAbout ? (
                <>
                  , or{" "}
                  <Link
                    href={`${base}/about`}
                    className="font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    get in touch
                  </Link>
                </>
              ) : null}
              .
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {properties.slice(0, 6).map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                href={`${base}/properties/${p.slug}`}
                showHost={false}
              />
            ))}
          </div>
        )}
      </section>

      {host.sitePageAbout && host.description ? (
        <section
          id="about"
          className="scroll-mt-24 border-t border-stone-200 bg-stone-50"
        >
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
            <h2 className="text-2xl font-semibold text-stone-900">About us</h2>
            <p className="mt-4 whitespace-pre-line text-stone-600 leading-relaxed">
              {host.description.length > 420
                ? `${host.description.slice(0, 420).trim()}…`
                : host.description}
            </p>
            <Link
              href={`${base}/about`}
              className="mt-6 inline-flex text-sm font-semibold text-[var(--color-brand)] hover:underline"
            >
              Read more →
            </Link>
          </div>
        </section>
      ) : null}

      {host.sitePageServices ? (
        <section
          id="services"
          className="scroll-mt-24 border-t border-stone-200"
        >
          <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
            <h2 className="text-xl font-semibold text-stone-900">
              {servicesLabel}
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              More from {host.name} — beyond the stay.
            </p>
            <Link
              href={`${base}/services`}
              className="mt-4 inline-flex text-sm font-semibold text-[var(--color-brand)] hover:underline"
            >
              Learn more →
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
