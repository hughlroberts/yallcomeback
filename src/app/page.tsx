import Image from "next/image";
import Link from "next/link";
import {
  getMarketplaceListings,
  getMarketplacePlaceSuggestions,
  marketplaceDiscoveryEnabled,
} from "@/lib/host";
import { PropertyCard } from "@/components/property-card";
import { StaySearchForm } from "@/components/stay-search-form";
import { GuestDiscoverySections } from "@/components/guest-discovery-sections";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const showDiscovery = await marketplaceDiscoveryEnabled();

  const [listings, liveHosts, featuredHost, placeSuggestions] =
    await Promise.all([
      getMarketplaceListings({ take: 6 }),
      prisma.host.count({
        where: {
          active: true,
          approvalStatus: "APPROVED",
          OR: [{ hostingMode: "SELF" }, { subscriptionStatus: "ACTIVE" }],
        },
      }),
      showDiscovery
        ? prisma.host.findFirst({
            where: { slug: "cherokee-landing", active: true },
            include: {
              properties: {
                where: { published: true },
                include: {
                  images: {
                    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
                    take: 1,
                  },
                  host: { select: { name: true, slug: true } },
                },
                take: 2,
                orderBy: { featured: "desc" },
              },
            },
          })
        : Promise.resolve(null),
      getMarketplacePlaceSuggestions(),
    ]);

  return (
    <div>
      {/* Hero — photo stays; brand only affects chrome/palette */}
      <section className="relative min-h-[72vh] overflow-hidden bg-stone-900">
        <div className="absolute inset-0">
          <Image
            src="/seed/hero/home.jpg"
            alt="Lakefront stay on Cedar Creek Lake"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <div
          className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-stone-950/25"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-honey/90">
            Book direct
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium tracking-tight text-white sm:text-5xl lg:text-6xl">
            The same stay
            <span className="block text-honey">minus the middle man</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-200">
            Big booking sites take a large share of every reservation. Yall Come
            Back is built so hosts keep more of what they earn - and guests,
            especially locals and return visitors, pay less in platform fees.
            Search, message, and book the way you already expect.
          </p>
          <div className="mt-8 w-full max-w-4xl">
            <StaySearchForm
              variant="hero"
              placeSuggestions={placeSuggestions}
            />
          </div>
          <p className="mt-6 text-sm text-stone-300">
            {liveHosts} active host{liveHosts === 1 ? "" : "s"} ·{" "}
            {listings.length}+ listing
            {listings.length === 1 ? "" : "s"} · free marketplace for
            independent hosts
          </p>
        </div>
      </section>

      {/* Why book here + primary CTAs */}
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Direct booking",
                body: "You book the place with the people who run it. Questions, check-in details, and the stay itself stay between you and the host - not a distant call center.",
              },
              {
                title: "More of the money stays put",
                body: "Big platforms take a large cut from hosts and stack service fees on guests. Here, more of what you pay goes to the stay - and hosts keep more of what they earn.",
              },
              {
                title: "Built for locals and return guests",
                body: "If you already know the property or live nearby, you should not pay a premium just to rebook. Search, message, and reserve without the extra platform tax.",
              },
            ].map((item) => (
              <div key={item.title}>
                <p className="text-sm font-semibold text-bonnet">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="rounded-full bg-bonnet px-6 py-3 text-sm font-semibold text-white hover:bg-bonnet-hover"
            >
              Find a stay
            </Link>
            <Link
              href="/for-hosts"
              className="rounded-full border border-bonnet/30 bg-petal px-6 py-3 text-sm font-semibold text-bonnet hover:bg-petal-hover"
            >
              Host without the cut
            </Link>
          </div>
        </div>
      </section>

      {/* Continuity rails only once inventory is large enough */}
      {showDiscovery ? (
        <GuestDiscoverySections className="border-b border-stone-200 bg-white" />
      ) : null}

      {/* Featured host — same threshold as discovery rails */}
      {showDiscovery && featuredHost && featuredHost.properties.length > 0 ? (
        <section className="bg-stone-50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-2">
              <div className="relative aspect-[5/4] overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
                <Image
                  src={
                    featuredHost.properties[0]?.images[0]?.url ||
                    "/seed/hero/home.jpg"
                  }
                  alt={featuredHost.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-bonnet">
                  Featured stay
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-stone-900">
                  {featuredHost.properties[0]?.title || featuredHost.name}
                </h2>
                <p className="mt-1 text-sm font-medium text-stone-500">
                  Hosted by {featuredHost.name}
                </p>
                {featuredHost.tagline ? (
                  <p className="mt-2 text-lg text-stone-600">
                    {featuredHost.tagline}
                  </p>
                ) : null}
                {featuredHost.description ? (
                  <p className="mt-4 text-stone-600 leading-relaxed">
                    {featuredHost.description.slice(0, 280)}
                    {featuredHost.description.length > 280 ? "…" : ""}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href={`/marketplace/properties/${featuredHost.properties[0].slug}?host=${featuredHost.slug}`}
                    className="rounded-full bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
                  >
                    View listing
                  </Link>
                  <Link
                    href="/marketplace"
                    className="rounded-full border border-lupine/50 bg-porcelain px-5 py-2.5 text-sm font-medium text-bonnet hover:bg-petal"
                  >
                    All stays
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Marketplace grid */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold text-stone-900">
              Places to stay
            </h2>
            <p className="mt-2 text-stone-500">
              The same stay minus the middle man
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-sm font-semibold text-bonnet hover:text-bonnet"
          >
            View all stays →
          </Link>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-12 text-center">
            <p className="text-stone-600">No marketplace listings yet.</p>
          </div>
        ) : (
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                href={`/marketplace/properties/${p.slug}?host=${p.host.slug}`}
                showHost
              />
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-cyan-950">
        <div className="absolute inset-0">
          <Image
            src="/seed/hero/marketplace.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-cyan-950/80" aria-hidden />
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold text-white">
            Hosting? Stop giving away a cut of every stay.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-cyan-100">
            List on the free marketplace, run a simple paid host site, or take
            the open-source stack and put your own brand on it. Guests get the
            familiar book-and-message flow - you keep more of what you earn.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/for-hosts"
              className="inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-bonnet hover:bg-petal"
            >
              Start hosting
            </Link>
            <Link
              href="/self-host"
              className="inline-block rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20"
            >
              Run your own site free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
