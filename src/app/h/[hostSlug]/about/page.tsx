import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHostBySlug } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

export default async function HostAboutPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();

  const base = await hostPublicBasePath(host.slug);

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
              <Link
                href={`${base}/contact`}
                className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
              >
                Contact
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
