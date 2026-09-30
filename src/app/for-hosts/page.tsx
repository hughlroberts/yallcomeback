import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HostSignupForm } from "@/components/HostSignupForm";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  SETUP_SERVICE_FEE_USD,
  SETUP_SERVICE_LABEL,
} from "@/lib/hosting";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Host a Place",
  description:
    "Built by hosts at Cherokee Landing. Automate return-guest bookings, keep the familiar stay, and skip the giant platform bill.",
};

export default async function ForHostsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; start?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const initialPath =
    params.path === "self" || params.path === "paid" ? params.path : "paid";
  const initialPlan =
    params.plan === "branded" || params.plan === "website"
      ? "website"
      : "marketplace";
  const session = await auth();
  const signedInUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, role: true, hostId: true },
      })
    : null;
  if (
    signedInUser &&
    (signedInUser.role === "HOST" || signedInUser.role === "ADMIN") &&
    signedInUser.hostId
  ) {
    redirect("/admin/payments?welcome=1");
  }

  // Public catalog only — complimentary ($0) plans are platform-assigned in Ops
  const plans = await prisma.hostingPlan.findMany({
    where: { isActive: true, monthlyPrice: { gt: 0 } },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <div className="relative overflow-hidden bg-stone-900">
        <Image
          src="/seed/hero/for-hosts.jpg"
          alt=""
          fill
          className="object-cover opacity-45"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/85 to-stone-900/40" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-honey/90">
            Host a place
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-medium tracking-tight text-white md:text-5xl">
            The return guests already know you.
            <span className="block text-honey">Make booking you easy.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-stone-300">
            We built Yall Come Back for the way we actually host: calendars,
            deposits, and “see you next summer” — automated, still familiar,
            without a giant platform bill.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#host-paths"
              className="rounded-full bg-honey px-5 py-2.5 text-sm font-semibold text-stone-900 hover:bg-honey/90"
            >
              Start hosting
            </a>
            <Link
              href="/marketplace"
              className="rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              Finding a place instead?
            </Link>
          </div>
        </div>
      </div>

      <section className="border-b border-stone-200 bg-buttermilk/60">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-bonnet">
              Cherokee Landing · Cedar Creek Lake
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Twenty years of return guests. Too much of it by hand.
            </h2>
            <p className="mt-4 text-stone-600 leading-relaxed">
              Hugh and his dad have hosted at Cherokee Landing for 20+ years.
              The same families came back. The work around that — texts, paper
              calendars, deposits, “is the dock cabin open in June?” — stayed
              manual. We wanted those processes on rails without changing how
              the place feels, and without paying a catalog a cut of every stay.
            </p>
            <p className="mt-4 text-stone-600 leading-relaxed">
              Yall Come Back is that tool. Your name on the booking. Your
              calendar. Your guests. We automate the busywork so you can keep
              hosting the way you already do.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Keep the relationship",
                body: "Return guests book you, not a stranger in a feed.",
              },
              {
                title: "Automate the busywork",
                body: "Calendars, deposits, and messages — without the paper pile.",
              },
              {
                title: "Same look and feel",
                body: "Your place, your name, the stay they already remember.",
              },
              {
                title: "Do not break the bank",
                body: "A small monthly hosting fee. No cut of the stay.",
              },
            ].map((item) => (
              <div key={item.title}>
                <p className="font-semibold text-stone-900">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="host-paths"
        className="border-b border-stone-200 bg-white"
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-bonnet">
              Two ways to host
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Marketplace, or your own branded site
            </h2>
            <p className="mt-3 text-stone-600">
              Same calendars and booking tools on both. No cut of the stay.
              Website hosts can turn Find a Place on or off anytime — it is
              included, not a second fee.
            </p>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Link
              href="/for-hosts?path=paid&plan=marketplace#apply"
              className="group flex flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:border-bonnet/30 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bonnet">
                1 · Marketplace only · $5/listing/mo
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900 group-hover:text-bonnet">
                List on Yall Come Back. Keep more of every stay.
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600">
                Guests search and book on the shared Yall Come Back marketplace
                with a familiar look and short listing URLs. You get calendars,
                messaging, Insights, and booking tools with{" "}
                <strong className="font-semibold text-stone-800">
                  no cut of the booking
                </strong>
                — just{" "}
                <strong className="font-semibold text-stone-800">
                  $5 per published listing / month
                </strong>
                . Perfect if you want discovery without a separate brand
                website.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-stone-500">
                <li>✓ $5 / published listing / month</li>
                <li>✓ Listing-first URLs (not a host mini-site)</li>
                <li>✓ Zero commission · marketplace only</li>
              </ul>
              <p className="mt-5 text-sm font-semibold text-bonnet">
                Start on the marketplace →
              </p>
            </Link>

            <Link
              href="/for-hosts?path=paid&plan=branded#apply"
              className="group flex flex-col rounded-3xl border border-bonnet/25 bg-gradient-to-br from-petal/60 to-white p-6 shadow-sm ring-1 ring-bonnet/10 transition hover:border-bonnet/40 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bonnet">
                2 · Branded website · $25/listing/mo
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900 group-hover:text-bonnet">
                Your brand, your domain. We host the site.
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-stone-600">
                Yall Come Back runs a real guest website for you: logo, palette,
                stays catalog, About, and an{" "}
                <strong className="font-semibold text-stone-800">
                  Other services
                </strong>{" "}
                page (boat rentals, camping, tours, even when it is not lodging).
                Point your own custom domain when you are ready.{" "}
                <strong className="font-semibold text-stone-800">
                  Marketplace listing is included
                </strong>{" "}
                — same stays can appear on Find a Place with no second fee.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-stone-500">
                <li>✓ $25 / published listing / month (includes marketplace)</li>
                <li>✓ Branded site + DNS on your domain</li>
                <li>✓ Demo to Live publish before DNS cutover</li>
              </ul>
              <p className="mt-5 text-sm font-semibold text-bonnet">
                Build my website →
              </p>
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "The stay they already know",
                  body: "Your name and photos on every listing — not a giant catalog logo in the middle.",
                  image: "/seed/lakefront/01.jpg",
                },
                {
                  title: "Calendar without the clipboard",
                  body: "Blocked dates, seasons, and iCal so the dock cabin is not double-booked.",
                  image: "/seed/eagles-nest/01.jpg",
                },
                {
                  title: "Deposits and messages",
                  body: "Holds, guest notes, and the “see you Friday” note — without starting from a blank text.",
                  image: "/seed/eagles-nest/02.jpg",
                },
                {
                  title: "A fee you can live with",
                  body: "Per published listing each month. Not a cut of every booking.",
                  image: "/seed/lakefront/03.jpg",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 25vw"
                    />
                  </div>
                  <div className="p-5">
                    <h2 className="font-semibold text-stone-900">{item.title}</h2>
                    <p className="mt-2 text-sm text-stone-600">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {plans.filter((p) => p.monthlyPrice > 0).length > 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6">
                <h2 className="text-xl font-semibold text-stone-900">
                  What it costs
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  A monthly hosting fee per published listing — not a cut of
                  each stay. That is how we keep the lights on without eating
                  the weekend the regulars already paid you for.
                </p>
                <ul className="mt-4 space-y-3">
                  {plans
                    .filter((p) => p.monthlyPrice > 0)
                    .map((plan) => (
                      <li
                        key={plan.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-4"
                      >
                        <div>
                          <p className="font-medium text-stone-900">
                            {plan.name}
                          </p>
                          {plan.description ? (
                            <p className="mt-0.5 text-sm text-stone-500">
                              {plan.description}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-lg font-semibold text-bonnet">
                          {formatMoney(plan.monthlyPrice)}
                          /listing/mo
                        </p>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-3xl border border-honey/50 bg-honey/10 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bonnet">
                Optional add-on
              </p>
              <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-stone-900">
                    {SETUP_SERVICE_LABEL}
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-600">
                    Prefer hands-off? We’ll set up the whole service for you —
                    listings (including imports), brand, calendars, and your own
                    website or custom domain when you want it. One-time fee;
                    monthly hosting is separate.
                  </p>
                  <ul className="mt-3 list-inside list-disc text-sm text-stone-600">
                    <li>Listings, photos, rates, and availability</li>
                    <li>Host brand and guest booking flow</li>
                    <li>Your domain / website when requested</li>
                  </ul>
                </div>
                <p className="text-2xl font-semibold tabular-nums text-bonnet">
                  {formatMoney(SETUP_SERVICE_FEE_USD)}
                  <span className="block text-sm font-medium text-stone-500">
                    one-time
                  </span>
                </p>
              </div>
              <p className="mt-4 text-xs text-stone-500">
                Check “Full setup service” on the form if you want us to load
                listings and brand for you.
              </p>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-stone-900">
                How it works
              </h2>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-stone-600">
                <li>Start hosting on your account. No wait for approval.</li>
                <li>
                  Put in the stays, calendar, and the look guests already know.
                </li>
                <li>
                  Add a card for the monthly hosting fee. Listings go live when
                  that is paid.
                </li>
                <li>
                  Return guests book you directly. You keep the stay money. We
                  do not take a cut.
                </li>
              </ol>
              <p className="mt-4 text-sm text-stone-500">
                Already hosting?{" "}
                <Link
                  href="/login?callbackUrl=/admin"
                  className="font-medium text-bonnet hover:underline"
                >
                  Sign in to Host admin
                </Link>
                .
              </p>
            </div>
          </div>

          <div id="apply">
            <HostSignupForm
              key={`${initialPath}-${initialPlan}`}
              initialPath={initialPath}
              initialPlan={initialPlan}
              existingAccount={
                signedInUser?.email
                  ? { name: signedInUser.name, email: signedInUser.email }
                  : null
              }
              plans={plans.map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                monthlyPrice: p.monthlyPrice,
                pricingModel: p.pricingModel,
                description: p.description,
                isDefault: p.isDefault,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
