import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import { blocksFromHost } from "@/lib/services-blocks";
import { ServicesPageLiveEditor } from "@/components/services-page-live-editor";
import { ServicesPageRenderer } from "@/components/services-page-renderer";

export const dynamic = "force-dynamic";

/**
 * Fixed "Other services" page — boat fleet / extras.
 * Hosts & platform admins edit live on this page (not only in /admin/brand).
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
  const blocks = blocksFromHost({
    siteServicesBlocks: host.siteServicesBlocks,
    siteServicesBody: host.siteServicesBody,
  });

  const session = await auth();
  const isPlatformAdmin = session?.user?.role === "ADMIN";
  const isThisHost =
    session?.user?.role === "HOST" && session.user.hostId === host.id;
  const accessInfo = resolveHostAccessInfo({
    isPlatform: isPlatformAdmin,
    hostId: isThisHost ? host.id : isPlatformAdmin ? host.id : null,
    hostAccess: session?.user?.hostAccess,
  });
  const canEdit =
    (isPlatformAdmin || isThisHost) && canManageBrand(accessInfo);

  return (
    <div>
      <div className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-brand,#2563eb)]">
            {title}
          </p>
          <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900">
            {title}
          </h1>
          <p className="mt-3 text-lg text-stone-600">From {host.name}</p>
          {canEdit ? (
            <p className="mt-3 text-sm text-sky-900">
              You&apos;re signed in as the host — edit boats, photos, and
              pricing on this page.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        {canEdit ? (
          <ServicesPageLiveEditor
            hostId={host.id}
            basePath={base}
            pageTitle={title}
            initialBlocks={blocks}
            returnTo={`${base}/services`}
          />
        ) : (
          <ServicesPageRenderer blocks={blocks} basePath={base} />
        )}

        {!canEdit ? (
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
        ) : null}
      </div>
    </div>
  );
}
