import Image from "next/image";
import Link from "next/link";
import { HostSignupForm } from "@/components/HostSignupForm";
import { prisma } from "@/lib/db";
import {
  SETUP_SERVICE_FEE_USD,
  SETUP_SERVICE_LABEL,
} from "@/lib/hosting";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Host a Place",
  description:
    "Host with Yall Come Back: paid platform hosting or free self-host on your own domain — not a cut of every booking.",
};

export default async function ForHostsPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const params = await searchParams;
  const initialPath =
    params.path === "self" || params.path === "paid" ? params.path : "paid";

  const plans = await prisma.hostingPlan.findMany({
    where: { isActive: true },
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
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-medium tracking-tight text-white md:text-5xl">
            Your place. Your brand.{" "}
            <span className="text-honey">Your rules.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-stone-300">
            Big platforms are built around their marketplace first. Yall Come Back
            is built around hosts: run paid hosting with us, or deploy free on your
            own website — and keep more of what you earn either way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#host-paths"
              className="rounded-full bg-honey px-5 py-2.5 text-sm font-semibold text-stone-900 hover:bg-honey/90"
            >
              Choose how you host
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

      {/* Clear split: two host paths (YCB differentiator vs marketplace-only brands) */}
      <section
        id="host-paths"
        className="border-b border-stone-200 bg-buttermilk/60"
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-bonnet">
              Two ways to host
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
              Not just another marketplace listing form
            </h2>
            <p className="mt-3 text-stone-600">
              VRBO and Airbnb steer every host into their catalog. Here you pick
              the path that fits: full-service on Yall Come Back, or free
              self-host on your domain with marketplace reach when you want it.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Link
              href="/for-hosts?path=paid#apply"
              className="group rounded-3xl border border-stone-200 bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:border-bonnet/30 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bonnet">
                Path 1 · Paid hosting
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900 group-hover:text-bonnet">
                We run the stack for you
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Monthly fee per published property — not a cut of every booking.
                Your brand, guest URLs, calendars, and booking flow on the
                platform. Opt into the free marketplace when it helps.
              </p>
              <p className="mt-4 text-sm font-semibold text-bonnet">
                Apply for paid hosting →
              </p>
            </Link>
            <Link
              href="/for-hosts?path=self#apply"
              className="group rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-sm ring-1 ring-emerald-900/5 transition hover:border-emerald-300 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
                Path 2 · Free self-host
              </p>
              <h3 className="mt-2 text-xl font-semibold text-stone-900 group-hover:text-emerald-900">
                Your domain, zero monthly platform fee
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Deploy free on your own website or any domain. Optionally list on
                the free Yall Come Back marketplace when you want discovery —
                without middleman commission.
              </p>
              <p className="mt-4 text-sm font-semibold text-emerald-900">
                Apply for free self-host →
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
                  title: "Your brand on every stay",
                  body: "Your name, logo, and bio show on every listing next to Reserve.",
                  image: "/seed/lakefront/01.jpg",
                },
                {
                  title: "Real photo galleries",
                  body: "Multiple images per stay so guests can picture the property.",
                  image: "/seed/eagles-nest/02.jpg",
                },
                {
                  title: "Seasons & calendar",
                  body: "Peak rates, blocked dates, and iCal sync for other channels.",
                  image: "/seed/eagles-nest/01.jpg",
                },
                {
                  title: "Simple hosting fee",
                  body: "Per published property each month - not a cut of every booking.",
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
                  Website hosting fee
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  Simple rate for platform-hosted sites — not a cut of each
                  booking. (Complimentary accounts are assigned by the platform
                  for owner or partner brands.)
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
                Check “Full setup service” on the application form. We’ll
                confirm scope and invoice after review.
              </p>
            </div>

            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="text-xl font-semibold text-stone-900">
                Migrating an existing site?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Recreate your brand on this stack, point your domain, and keep
                every stay, with optional free marketplace discovery. Full deploy
                and migration notes for existing resort and rental operators.
              </p>
              <Link
                href="/self-host"
                className="mt-4 inline-flex text-sm font-semibold text-emerald-900 hover:underline"
              >
                Free self-host &amp; deploy guide →
              </Link>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-stone-900">
                How approval works
              </h2>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-stone-600">
                <li>
                  Apply as paid hosting or free self-host with your brand
                  details.
                </li>
                <li>Platform admin reviews and approves your host account.</li>
                <li>
                  Paid hosts: pay the monthly fee, then choose Yall Come Back URLs
                  and/or your own domain in Host admin.
                </li>
                <li>
                  Self-hosts and paid hosts both choose marketplace on or off.
                  Self-hosts: deploy on your domain at $0 / month platform fee.
                </li>
              </ol>
              <p className="mt-4 text-sm text-stone-500">
                Already approved?{" "}
                <Link
                  href="/login"
                  className="font-medium text-bonnet hover:underline"
                >
                  Sign in to the host portal
                </Link>
                .
              </p>
            </div>
          </div>

          <div id="apply">
            <HostSignupForm
              initialPath={initialPath}
              plans={plans.map((p) => ({
                id: p.id,
                name: p.name,
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
