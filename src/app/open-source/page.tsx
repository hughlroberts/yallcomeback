import Link from "next/link";
import {
  FEATURE_GROUPS,
  LICENSE,
  PRODUCT_NAME,
  PRODUCT_VERSION,
  REPO_URL,
  SELF_HOST_DEV_STEPS,
  STRIPE_LIVE_READY,
} from "@/lib/features";

export const metadata = {
  title: "Open source · free self-host",
  description: `Run a free copy of ${PRODUCT_NAME} on your own website. MIT licensed, full feature set.`,
};

export default function OpenSourcePage() {
  return (
    <div>
      <div className="relative overflow-hidden bg-stone-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/40 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300/90">
            Free · {LICENSE} · v{PRODUCT_VERSION}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Copy {PRODUCT_NAME} for your own website - free and open source
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-300">
            Hosts can run the entire platform themselves: branded sites,
            marketplace, calendars, bookings, iCal, and admin. No license fee.
            When we ship new features here, they land in this same codebase for
            you to pull in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {REPO_URL ? (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                View on GitHub
              </a>
            ) : (
              <a
                href="#setup"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                Get the free copy
              </a>
            )}
            <a
              href="#features"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              What&apos;s included
            </a>
            <Link
              href="/self-host"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Self-host deploy guide
            </Link>
            <Link
              href="/for-hosts?path=paid"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-stone-300 hover:bg-white/5"
            >
              Prefer we host it for you?
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-stone-200 bg-emerald-50">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <p className="text-sm text-emerald-950">
            <strong>Free forever for self-hosting.</strong> You can still publish
            on the central Yall Come Back marketplace: register as free self-host
            (or paid), opt into marketplace, then either manage listings on this
            platform or push from a remote open-source deploy with a syndication
            API key (Admin → Brand &amp; website). Platform website hosting (our
            servers, monthly fee) is optional. The software itself is {LICENSE}{" "}
            open source - reuse, modify, and run on
            your own domain at no cost.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <section id="setup" className="scroll-mt-24">
          <h2 className="text-3xl font-semibold text-stone-900">
            How to run your own copy
          </h2>
          <p className="mt-2 max-w-2xl text-stone-600">
            This is the same stack powering the demo you&apos;re browsing. Point
            your domain at it when you&apos;re ready.
          </p>

          <div className="mt-6 space-y-3">
            {!REPO_URL ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <strong>Repo URL placeholder.</strong> Public git link will be
                added at go-live (
                <code className="rounded bg-amber-100/80 px-1">REPO_URL</code> in{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  src/lib/features.ts
                </code>
                ). Until then, use the local project folder or your private
                remote.
              </div>
            ) : (
              <p className="text-sm text-stone-600">
                Source:{" "}
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-bonnet underline-offset-2 hover:underline"
                >
                  {REPO_URL}
                </a>
              </p>
            )}
            {!STRIPE_LIVE_READY ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <strong>Stripe setup placeholder.</strong> Leave{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  STRIPE_ENABLED=false
                </code>{" "}
                in{" "}
                <code className="rounded bg-amber-100/80 px-1">.env</code>.
                Manual deposits and hosting invoices work without Stripe. Keys
                and{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  STRIPE_LIVE_READY
                </code>{" "}
                are wired at go-live only.
              </div>
            ) : null}
          </div>

          <ol className="mt-8 space-y-4">
            {SELF_HOST_DEV_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-bonnet text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-stone-900">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 overflow-hidden rounded-2xl border border-stone-800 bg-stone-950 text-stone-100 shadow-lg">
            <div className="border-b border-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-stone-400">
              Terminal
            </div>
            <pre className="overflow-x-auto p-5 text-sm leading-relaxed">
{REPO_URL
  ? `# Clone the free open-source copy
git clone ${REPO_URL}
cd yallcomeback

npm install
cp .env.example .env   # set AUTH_SECRET at minimum
npm run db:setup
npm run dev

# Production
npm run build && npm start
# or: docker compose up`
  : `# From the project root (public git URL added at launch)
npm install
cp .env.example .env   # set AUTH_SECRET at minimum
npm run db:setup
npm run dev

# Production
npm run build && npm start
# or: docker compose up`}
            </pre>
          </div>

          <p className="mt-4 text-sm text-stone-500">
            Full install notes live in the repository{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-800">
              README.md
            </code>
            . Feature inventory is maintained in{" "}
            <code className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-800">
              src/lib/features.ts
            </code>{" "}
            so this page stays accurate as the product grows.
          </p>
        </section>

        <section id="features" className="mt-16 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold text-stone-900">
                Everything included (so far)
              </h2>
              <p className="mt-2 max-w-2xl text-stone-600">
                Version {PRODUCT_VERSION}. When new capabilities ship on this
                platform, they&apos;re added to the open-source tree and listed
                here.
              </p>
            </div>
            <span className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
              {LICENSE} license
            </span>
          </div>

          <div className="mt-10 space-y-6">
            {FEATURE_GROUPS.map((group) => (
              <article
                key={group.category}
                className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
              >
                <h3 className="text-xl font-semibold text-stone-900">
                  {group.category}
                </h3>
                <p className="mt-1 text-sm text-stone-500">{group.summary}</p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-2 text-sm text-stone-700"
                    >
                      <span className="mt-0.5 text-cyan-700">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-stone-200 bg-stone-50 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-stone-900">
              Self-host (free)
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              <li>You run the app on your server or VPS</li>
              <li>You own the data and guest relationship</li>
              <li>No monthly platform fee for the software</li>
              <li>You maintain updates by pulling this repo</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-stone-900">
              Platform-hosted (paid)
            </h2>
            <ul className="mt-4 space-y-2 text-sm text-stone-600">
              <li>We list your stays with host branding on each listing</li>
              <li>Approval + monthly fee per published property</li>
              <li>Still not a booking commission</li>
              <li>
                Apply at{" "}
                <Link href="/for-hosts" className="font-semibold text-bonnet underline">
                  /for-hosts
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            See it working first
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-stone-600">
            Browse the demo stays and calendars, then spin up your own copy with
            the same features.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/self-host"
              className="rounded-[var(--radius-control)] bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              Free self-host guide
            </Link>
            <Link
              href="/for-hosts?path=self"
              className="rounded-full border border-lupine/50 bg-porcelain px-5 py-2.5 text-sm font-medium text-bonnet hover:bg-petal"
            >
              Apply as free self-host
            </Link>
            <Link
              href="/marketplace"
              className="rounded-full border border-lupine/50 bg-porcelain px-5 py-2.5 text-sm font-medium text-bonnet hover:bg-petal"
            >
              Browse demo stays
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
