import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import { hostSocialLinks } from "@/lib/host-site";

export const dynamic = "force-dynamic";

/**
 * Fixed About page (toggle on/off in Brand admin).
 * Includes story + phone, address, email, socials — not a freeform CMS page.
 */
export default async function HostAboutPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host || !host.sitePageAbout) notFound();

  const base = await hostPublicBasePath(host.slug);
  const socials = hostSocialLinks(host);

  return (
    <div>
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand,#2563eb)]">
            About
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900">
            {host.name}
          </h1>
          {host.tagline ? (
            <p className="mt-3 text-lg text-stone-600">{host.tagline}</p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
          {host.logoUrl ? (
            <div className="relative mx-auto size-28 shrink-0 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200 sm:mx-0 sm:size-32">
              <Image
                src={host.logoUrl}
                alt={host.name}
                fill
                className="object-cover"
                sizes="128px"
                unoptimized
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {host.description ? (
              <div className="whitespace-pre-line text-base leading-relaxed text-stone-700">
                {host.description}
              </div>
            ) : (
              <p className="text-stone-600 leading-relaxed">
                Welcome to {host.name}. We host stays for guests who want to book
                direct — no marketplace middleman. Reach out anytime; we&apos;re
                happy to help plan your trip.
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`${base}/stays`}
                className="rounded-full bg-[var(--color-brand,#2563eb)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover,#1d4ed8)]"
              >
                View stays
              </Link>
            </div>
          </div>
        </div>

        {/* Contact block — always part of About when page is on */}
        <section
          id="contact"
          className="mt-14 scroll-mt-24 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
        >
          <h2 className="text-lg font-semibold text-stone-900">Contact</h2>
          <p className="mt-1 text-sm text-stone-500">
            You&apos;re contacting {host.name} directly.
          </p>
          <dl className="mt-6 space-y-4 text-sm">
            {host.siteAddress ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Address
                </dt>
                <dd className="mt-1 whitespace-pre-line text-base text-stone-800">
                  {host.siteAddress}
                </dd>
              </div>
            ) : null}
            {host.contactPhone ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Phone
                </dt>
                <dd className="mt-1">
                  <a
                    href={`tel:${host.contactPhone.replace(/\s+/g, "")}`}
                    className="text-base font-medium text-stone-900 hover:text-[var(--color-brand)]"
                  >
                    {host.contactPhone}
                  </a>
                </dd>
              </div>
            ) : null}
            {host.contactEmail ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Email
                </dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${host.contactEmail}`}
                    className="text-base font-medium text-[var(--color-brand,#2563eb)] hover:underline"
                  >
                    {host.contactEmail}
                  </a>
                </dd>
              </div>
            ) : null}
            {!host.siteAddress && !host.contactPhone && !host.contactEmail ? (
              <p className="text-stone-500">
                Contact details coming soon. Book a stay to message us after you
                reserve.
              </p>
            ) : null}
          </dl>

          {socials.length > 0 ? (
            <div className="mt-8 border-t border-stone-100 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Follow
              </p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {socials.map((s) => (
                  <li key={s.network}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm font-medium text-stone-800 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
