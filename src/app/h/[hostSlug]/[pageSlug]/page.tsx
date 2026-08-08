import { notFound, redirect } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import {
  HOST_SITE_RESERVED_PATHS,
  hostServicesHref,
  hostServicesPathSegment,
} from "@/lib/host-site";
import { HostServicesPageView } from "@/components/host-services-page";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Custom host page slug — currently used for the Services / boat rentals page
 * when siteServicesPath is set (e.g. /h/cherokee-landing/boat-rentals).
 * Reserved paths (stays, about, …) are handled by their own routes.
 */
export default async function HostCustomPageSlug({
  params,
}: {
  params: Promise<{ hostSlug: string; pageSlug: string }>;
}) {
  const { hostSlug, pageSlug: rawSlug } = await params;
  const pageSlug = slugify(rawSlug);

  if (!pageSlug || HOST_SITE_RESERVED_PATHS.has(pageSlug)) {
    notFound();
  }

  const host = await getHostForGuestSite(hostSlug);
  if (!host || !host.sitePageServices) notFound();

  const expected = hostServicesPathSegment(host);
  if (pageSlug !== expected) {
    notFound();
  }

  // Prefer canonical path without trailing issues
  if (rawSlug !== pageSlug) {
    const base = await hostPublicBasePath(host.slug);
    redirect(hostServicesHref(host, base));
  }

  return <HostServicesPageView host={host} />;
}
