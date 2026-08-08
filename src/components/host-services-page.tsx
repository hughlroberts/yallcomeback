import Link from "next/link";
import { auth } from "@/lib/auth";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import type { Host } from "@prisma/client";
import { hostPublicBasePath } from "@/lib/host-base-path";
import {
  hostServicesHref,
  hostServicesPageLabel,
} from "@/lib/host-site";
import {
  blocksFromHost,
  boatRentalsStarterBlocks,
} from "@/lib/services-blocks";
import { ServicesPageLiveEditor } from "@/components/services-page-live-editor";
import { ServicesPageRenderer } from "@/components/services-page-renderer";

type HostForServices = Host;

/**
 * Shared Services / boat rentals page body (used by /services and custom path).
 */
export async function HostServicesPageView({
  host,
}: {
  host: HostForServices;
}) {
  const base = await hostPublicBasePath(host.slug);
  const title = hostServicesPageLabel(host);
  const pageHref = hostServicesHref(host, base);
  const savedBlocks = blocksFromHost({
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

  const editorBlocks =
    canEdit && savedBlocks.length === 0
      ? boatRentalsStarterBlocks()
      : savedBlocks;

  const loginHref = `/login?callbackUrl=${encodeURIComponent(pageHref)}`;

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
            <p className="mt-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-950">
              Edit mode — change boats, photos &amp; pricing below, then Save
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
            initialBlocks={editorBlocks}
            returnTo={pageHref}
          />
        ) : (
          <>
            <ServicesPageRenderer blocks={savedBlocks} basePath={base} />
            <div className="mt-10 flex flex-wrap items-center gap-3">
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
              <Link
                href={loginHref}
                className="rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-950 hover:bg-sky-100"
              >
                Host sign in to edit
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
