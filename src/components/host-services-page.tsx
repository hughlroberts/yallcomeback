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
  type ServicesBlock,
} from "@/lib/services-blocks";
import { ServicesPageLiveEditor } from "@/components/services-page-live-editor";
import { ServicesPageRenderer } from "@/components/services-page-renderer";

type HostForServices = Host;

/** Drop a leading heading that only repeats the page title (avoids double headers). */
function guestBlocksWithoutDupTitle(
  blocks: ServicesBlock[],
  pageTitle: string,
): ServicesBlock[] {
  if (blocks.length === 0) return blocks;
  const first = blocks[0]!;
  if (first.type !== "heading") return blocks;
  const a = first.content.trim().toLowerCase().replace(/\s+/g, " ");
  const b = pageTitle.trim().toLowerCase().replace(/\s+/g, " ");
  if (!a) return blocks.slice(1);
  if (a === b || b.includes(a) || a.includes(b)) {
    return blocks.slice(1);
  }
  return blocks;
}

/**
 * Shared Services / boat rentals page body (used by /services and custom path).
 * Layout matches Stays: one title band, full-width content (no double headers).
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

  const guestBlocks = guestBlocksWithoutDupTitle(savedBlocks, title);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Single page title (Stays-style) — content blocks should not repeat it */}
      <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-stone-600">From {host.name}</p>
      {canEdit ? (
        <p className="mt-4 inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-950">
          Edit mode — change boats, photos &amp; pricing below, then Save
        </p>
      ) : null}

      <div className="mt-10">
        {canEdit ? (
          <ServicesPageLiveEditor
            hostId={host.id}
            basePath={base}
            pageTitle={title}
            initialBlocks={editorBlocks}
            returnTo={pageHref}
          />
        ) : (
          <ServicesPageRenderer blocks={guestBlocks} basePath={base} />
        )}
      </div>
    </div>
  );
}
