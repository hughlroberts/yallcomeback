import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div>
      <div className="relative overflow-hidden bg-stone-900">
        <Image
          src="/seed/hero/contact.jpg"
          alt=""
          fill
          className="object-cover opacity-45"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/85 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-200/90">
            Contact
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
            We&apos;d love to hear from you
          </h1>
          <p className="mt-4 max-w-xl text-lg text-stone-300">
            Questions about hosting, billing, or a stay you saw on the
            marketplace? Reach out and we&apos;ll point you in the right
            direction.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-900">Guests</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              For a specific property, use the booking form on the listing or the
              host&apos;s website. That goes straight to the host.
            </p>
            <Link
              href="/marketplace"
              className="mt-4 inline-flex text-sm font-semibold text-bonnet hover:underline"
            >
              Browse marketplace →
            </Link>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-900">Hosts</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              New applications, subscription questions, and website hosting go
              through the host portal after you apply.
            </p>
            <Link
              href="/for-hosts"
              className="mt-4 inline-flex text-sm font-semibold text-bonnet hover:underline"
            >
              Apply to host →
            </Link>
          </div>
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-stone-900">Platform</h2>
            <p className="mt-3 text-sm leading-relaxed text-stone-600">
              Demo contact email for this local build:
            </p>
            <a
              href="mailto:hello@yallcomeback.com"
              className="mt-4 inline-flex text-sm font-semibold text-bonnet hover:underline"
            >
              hello@yallcomeback.com
            </a>
          </div>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-stone-200 bg-stone-50">
          <div className="grid md:grid-cols-2">
            <div className="relative min-h-[240px]">
              <Image
                src="/seed/eagles-nest/01.jpg"
                alt="Living room with lake views"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-10">
              <h2 className="text-2xl font-semibold text-stone-900">
                Prefer to browse a stay first?
              </h2>
              <p className="mt-3 text-stone-600">
                Open our demo lake listings - real photos, calendar, and host
                details next to Reserve.
              </p>
              <Link
                href="/marketplace"
                className="mt-6 inline-flex w-fit rounded-full bg-bonnet px-5 py-2.5 text-sm font-medium text-white hover:bg-bonnet-hover"
              >
                Browse stays
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
