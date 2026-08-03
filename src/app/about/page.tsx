import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div>
      <div className="relative overflow-hidden bg-stone-900">
        <Image
          src="/seed/hero/about.jpg"
          alt=""
          fill
          className="object-cover opacity-50"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-stone-900/30" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200/90">
            About Yall Come Back
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Host websites first. Marketplace second.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-300">
            Yall Come Back is built for independent vacation rental hosts who want a
            professional website under their own brand - with an optional shared
            marketplace when they choose to list.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-stone-900">
                Why we built this
              </h2>
              <p className="mt-3 leading-relaxed text-stone-600">
                Most platforms take a cut of every booking and own the guest
                relationship. Yall Come Back flips that: you get a host-branded site,
                direct booking requests, seasonal rates, and calendar tools. If
                you want more discovery, you can opt into the marketplace.
              </p>
            </section>
            <section>
              <h2 className="text-2xl font-semibold text-stone-900">
                How hosting works
              </h2>
              <ul className="mt-3 space-y-3 text-stone-600">
                <li className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                  Apply to host - we review before anything goes public.
                </li>
                <li className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                  Choose platform website hosting or keep your own domain later.
                </li>
                <li className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                  Pay a simple monthly fee per published property (not a booking
                  commission).
                </li>
              </ul>
            </section>
          </div>

          {/* Narrative panel: your brand owns the booking, not a middleman */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-6 text-white shadow-lg shadow-slate-900/10 sm:p-7">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-petal0/20 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl"
              aria-hidden
            />

            <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-blue-200/90">
              What guests see
            </p>
            <h3 className="relative mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              Your name on the door.
              <span className="block text-blue-100/90">
                Not a giant logo in the middle.
              </span>
            </h3>

            {/* Mini “your site” browser mock */}
            <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-inner backdrop-blur-sm">
              <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                <span className="flex gap-1" aria-hidden>
                  <span className="size-2 rounded-full bg-white/20" />
                  <span className="size-2 rounded-full bg-white/20" />
                  <span className="size-2 rounded-full bg-white/20" />
                </span>
                <div className="ml-1 flex-1 truncate rounded-md bg-white/10 px-2.5 py-1 text-[11px] text-white/70">
                  yourbrand.com
                </div>
              </div>
              <div className="grid grid-cols-[1.1fr_0.9fr] gap-3 p-3 sm:gap-4 sm:p-4">
                <div className="space-y-2.5">
                  <div className="h-2 w-16 rounded-full bg-honey/50" />
                  <div className="h-3 w-full rounded-full bg-white/20" />
                  <div className="h-3 w-4/5 rounded-full bg-white/10" />
                  <div className="mt-3 space-y-1.5">
                    {["Photos & story", "Your calendar", "Message you"].map(
                      (line) => (
                        <div
                          key={line}
                          className="flex items-center gap-2 text-[11px] text-white/75 sm:text-xs"
                        >
                          <span
                            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] text-emerald-300"
                            aria-hidden
                          >
                            ✓
                          </span>
                          {line}
                        </div>
                      ),
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">
                    Reserve
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">
                    Direct
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-white/60">
                    Request goes to you — not a marketplace inbox.
                  </p>
                  <div className="mt-3 h-8 rounded-lg bg-petal0 text-center text-[11px] font-semibold leading-8 text-white shadow-sm shadow-blue-500/30">
                    Book with host
                  </div>
                </div>
              </div>
            </div>

            {/* Contrast strip */}
            <div className="relative mt-5 grid grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-[11px] font-medium text-white/50">
                  Big booking sites
                </p>
                <p className="mt-1 text-sm font-semibold text-rose-200/90">
                  % of every stay
                </p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  They own the guest
                </p>
              </div>
              <div className="rounded-2xl border border-blue-400/30 bg-petal0/15 px-3 py-3">
                <p className="text-[11px] font-medium text-blue-200/80">
                  Yall Come Back
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Flat monthly fee
                </p>
                <p className="mt-0.5 text-[11px] text-blue-100/70">
                  You keep the relationship
                </p>
              </div>
            </div>

            <p className="relative mt-5 text-sm leading-relaxed text-white/65">
              Start with a site that feels like you. Add the marketplace only
              when you want more discovery — never the other way around.
            </p>

            <div className="relative mt-5 flex flex-wrap gap-3">
              <Link
                href="/for-hosts"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-petal"
              >
                Host with Yall Come Back
              </Link>
              <Link
                href="/marketplace"
                className="rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Browse stays
              </Link>
            </div>
          </div>
        </div>

        {/* Founders */}
        <section className="mt-16 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-bonnet">
                About the founders
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Hugh &amp; Yum Roberts
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Together with their three kids, they&apos;re the family behind
                Yall Come Back.
              </p>

              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-600">
                <p>
                  Yall Come Back started at home, not in a boardroom. Hugh and Yum
                  know what it means to welcome people to a place you care about
                  — and how frustrating it is when big platforms take a large cut
                  of every stay while owning the guest relationship.
                </p>
                <p>
                  They built Yall Come Back so independent hosts can put their own
                  brand first: a real website, direct booking, and tools that
                  keep the conversation between host and guest. The marketplace
                  is optional discovery, not the product.
                </p>
                <p>
                  When they&apos;re not shipping features or helping hosts get
                  live, you&apos;ll find the Roberts family of five somewhere
                  between school runs, lake weekends, and another round of
                  &ldquo;can we open the calendar for that week?&rdquo;
                </p>
              </div>

              <p className="mt-6 text-sm font-medium text-slate-800">
                Made in Texas — by a Texas family that hosts, parents, and builds
                in the same week.
              </p>
            </div>

            <div className="relative flex flex-col justify-between gap-6 border-t border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/60 p-7 sm:p-9 lg:border-l lg:border-t-0">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Family of five
                </p>
                <ul className="mt-4 space-y-3">
                  {[
                    {
                      who: "Hugh",
                      role: "Product, engineering, and host tools",
                    },
                    {
                      who: "Yum",
                      role: "Family operations and the real-world host lens",
                    },
                    {
                      who: "Three kids",
                      role: "Official QA team for “would we stay here?”",
                    },
                  ].map((row) => (
                    <li
                      key={row.who}
                      className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm"
                    >
                      <span
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-petal text-xs font-bold text-bonnet"
                        aria-hidden
                      >
                        {row.who === "Three kids"
                          ? "3"
                          : row.who.charAt(0)}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {row.who}
                        </p>
                        <p className="text-sm text-slate-500">{row.role}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                Prefer a real conversation over a sales funnel?{" "}
                <Link
                  href="/contact"
                  className="font-medium text-bonnet hover:underline"
                >
                  Say hello
                </Link>
                {" · "}
                <Link
                  href="/for-hosts"
                  className="font-medium text-bonnet hover:underline"
                >
                  Host with us
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
