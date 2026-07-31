import Link from "next/link";
import { notFound } from "next/navigation";
import { getHostBySlug } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

export default async function HostContactPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();

  const base = await hostPublicBasePath(host.slug);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand,#2563eb)]">
        Contact
      </p>
      <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900">
        Get in touch
      </h1>
      <p className="mt-3 text-stone-600">
        You&apos;re contacting {host.name} directly — not a call center for a
        booking platform.
      </p>

      <div className="mt-10 space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        {host.contactEmail ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Email
            </p>
            <a
              href={`mailto:${host.contactEmail}`}
              className="mt-1 block text-lg font-medium text-[var(--color-brand,#2563eb)] hover:underline"
            >
              {host.contactEmail}
            </a>
          </div>
        ) : null}
        {host.contactPhone ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Phone
            </p>
            <a
              href={`tel:${host.contactPhone.replace(/\s+/g, "")}`}
              className="mt-1 block text-lg font-medium text-stone-900 hover:underline"
            >
              {host.contactPhone}
            </a>
          </div>
        ) : null}
        {!host.contactEmail && !host.contactPhone ? (
          <p className="text-stone-600">
            Contact details are being updated. In the meantime, book a stay and
            use the listing message host flow after you reserve.
          </p>
        ) : null}
        {host.websiteUrl ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              Website
            </p>
            <a
              href={host.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-sm font-medium text-stone-700 hover:underline"
            >
              {host.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          </div>
        ) : null}
      </div>

      <p className="mt-8 text-center text-sm text-stone-500">
        Ready to book?{" "}
        <Link
          href={`${base}/stays`}
          className="font-semibold text-[var(--color-brand)] hover:underline"
        >
          Browse stays
        </Link>
      </p>
    </div>
  );
}
