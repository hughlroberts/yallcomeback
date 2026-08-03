import Link from "next/link";
import { notFound } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

/**
 * Fixed "Other services" page (boats, tours, etc.) — toggle on/off only.
 * Not a freeform page builder.
 */
export default async function HostServicesPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host || !host.sitePageServices) notFound();

  const base = await hostPublicBasePath(host.slug);
  const title = host.siteServicesTitle?.trim() || "Other services";
  const hasBody = Boolean(host.siteServicesBody?.trim());
  const body =
    host.siteServicesBody?.trim() ||
    `Details coming soon. Contact ${host.name} to learn about services beyond the stay.`;

  return (
    <div>
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand,#2563eb)]">
            Services
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900">
            {title}
          </h1>
          <p className="mt-3 text-lg text-stone-600">
            From {host.name}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div
          className={
            hasBody
              ? "whitespace-pre-line text-base leading-relaxed text-stone-700"
              : "rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center text-stone-600"
          }
        >
          {body}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={`${base}/stays`}
            className="rounded-full bg-[var(--color-brand,#2563eb)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-hover,#1d4ed8)]"
          >
            Book a stay
          </Link>
          {host.sitePageAbout ? (
            <Link
              href={`${base}/about#contact`}
              className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              Contact
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
