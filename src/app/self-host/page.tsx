import Link from "next/link";
import {
  LICENSE,
  PRODUCT_NAME,
  PRODUCT_VERSION,
  REPO_URL,
  SELF_HOST_STEPS,
  STRIPE_LIVE_READY,
} from "@/lib/features";

export const metadata = {
  title: "Free self-host · migrate your rental website",
  description: `Deploy ${PRODUCT_NAME} on your own website or any domain. Free MIT software. Listings also appear on the free Yall Come Back marketplace.`,
};

export default function SelfHostPage() {
  return (
    <div>
      <div className="relative overflow-hidden bg-stone-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/50 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300/90">
            Free self-host · {LICENSE} · v{PRODUCT_VERSION}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Run {PRODUCT_NAME} on your own website - free
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-300">
            Already have a rental website? Run Yall Come Back on your own domain
            with ordinary website hosting - keep your brand, and still list
            every stay on the free Yall Come Back marketplace so guests can find you
            either way.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {REPO_URL ? (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                Get the code
              </a>
            ) : (
              <a
                href="#deploy"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                Deploy steps
              </a>
            )}
            <Link
              href="/for-hosts?path=self"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Register free self-host
            </Link>
            <Link
              href="/for-hosts?path=paid"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-stone-300 hover:bg-white/5"
            >
              Prefer we host it (paid)?
            </Link>
            <Link
              href="/open-source"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-stone-300 hover:bg-white/5"
            >
              Full feature list
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-stone-200 bg-emerald-50">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <p className="text-sm text-emerald-950">
            <strong>Self-host = free software ($0 / month platform fee).</strong>{" "}
            You run the app on your servers/domain. Listing on the Yall Come Back
            marketplace is <strong>optional</strong> — same choice paid hosts get.
            Optional one-time full setup ($500) is available if you want help
            going live.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        {/* Two paths */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border-2 border-cyan-800 bg-cyan-50/40 p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
              Free · self-host
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">
              Your domain, our open source
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-stone-700">
              <li>· Deploy on your website (or any domain)</li>
              <li>· Full admin, calendars, bookings, photos, iCal</li>
              <li>· Optional free Yall Come Back marketplace listing (your choice)</li>
              <li>· No monthly platform fee, no booking commission</li>
              <li>· You own ops: SSL, backups, updates</li>
            </ul>
            <a
              href="#deploy"
              className="mt-6 inline-flex rounded-full bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
            >
              How to deploy →
            </a>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Paid · platform hosting
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-900">
              We run it for you
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-relaxed text-stone-700">
              <li>· Monthly fee per property (not per booking)</li>
              <li>
                · Choose guest surface: Yall Come Back listing URLs, your domain, or
                both
              </li>
              <li>· Marketplace on/off is your admin setting</li>
              <li>· Approval + hosting invoice before going live</li>
            </ul>
            <Link
              href="/for-hosts?path=paid"
              className="mt-6 inline-flex rounded-full border border-lupine/50 bg-porcelain px-5 py-2.5 text-sm font-medium text-bonnet hover:bg-petal"
            >
              Paid hosting plans →
            </Link>
          </div>
        </section>

        {/* Migration story */}
        <section className="mt-16 rounded-3xl border border-stone-200 bg-stone-50 p-8 sm:p-10">
          <h2 className="text-2xl font-semibold text-stone-900">
            Example: migrate your existing site
          </h2>
          <ol className="mt-6 space-y-4 text-sm leading-relaxed text-stone-700">
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bonnet text-xs font-bold text-white">
                1
              </span>
              <span>
                <strong className="text-stone-900">Stand up this app</strong> on
                a VPS or PaaS (see deploy steps). Point your domain&apos;s DNS
                at it.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bonnet text-xs font-bold text-white">
                2
              </span>
              <span>
                <strong className="text-stone-900">Import your stays</strong> - 
                photos, rates, peak nights, house rules, sleeping layouts - 
                using admin or seed scripts.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bonnet text-xs font-bold text-white">
                3
              </span>
              <span>
                <strong className="text-stone-900">Register as free self-host</strong>{" "}
                on Yall Come Back (hosting mode: Self) so your brand is known and
                published listings syndicate to the free marketplace.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bonnet text-xs font-bold text-white">
                4
              </span>
              <span>
                <strong className="text-stone-900">Guests book either place</strong>{" "}
 - on your domain or via Yall Come Back discovery. Calendars stay yours
                to manage (iCal + blocks).
              </span>
            </li>
          </ol>
        </section>

        {/* Deploy steps - website hosting language (not developer / Postgres ops) */}
        <section id="deploy" className="mt-16 scroll-mt-24">
          <h2 className="text-2xl font-semibold text-stone-900">
            Put it on your website
          </h2>
          <p className="mt-2 max-w-2xl text-stone-600">
            Built for rental operators who want their own website and domain - 
            not a developer toolkit. Same Yall Come Back tools for photos, calendars,
            and bookings. No license fee. You (or your web person) control the
            hosting and the domain.
          </p>
          <ol className="mt-8 space-y-4">
            {SELF_HOST_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bonnet text-sm font-bold text-white">
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
          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4 text-sm text-stone-700">
              Prefer we handle hosting, updates, and uptime?{" "}
              <Link
                href="/for-hosts?path=paid"
                className="font-semibold text-bonnet underline-offset-2 hover:underline"
              >
                Paid platform hosting
              </Link>{" "}
              keeps you on Yall Come Back&apos;s servers with a simple monthly fee.
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
              {STRIPE_LIVE_READY
                ? "Card payments can be turned on when you are ready for live deposits."
                : "Card payments can stay off for now - you can still take deposits and mark them paid when money arrives."}
            </div>
            <p className="text-xs text-stone-500">
              Web developers who want the technical install (code, database,
              server commands) can use the{" "}
              <Link
                href="/open-source"
                className="font-medium text-stone-700 underline-offset-2 hover:underline"
              >
                open source
              </Link>{" "}
              page.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 rounded-3xl bg-stone-900 px-8 py-12 text-center text-white">
          <h2 className="text-2xl font-semibold">Ready to migrate?</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-stone-300">
            Deploy free on your domain, or apply for paid platform hosting with
            Yall Come Back URLs and optional marketplace.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {REPO_URL ? (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                Clone / download
              </a>
            ) : null}
            <Link
              href="/for-hosts?path=self"
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Register as free self-host
            </Link>
            <Link
              href="/for-hosts?path=paid"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-stone-300 hover:bg-white/5"
            >
              Apply for paid hosting
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
