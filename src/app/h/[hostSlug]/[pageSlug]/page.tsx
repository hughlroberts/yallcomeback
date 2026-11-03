import type { Metadata } from "next";
import { hostServicesPageOn } from "@/lib/services-access";
import { notFound, redirect } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import {
  HOST_SITE_RESERVED_PATHS,
  hostServicesHref,
  hostServicesPageLabel,
  hostServicesPathSegment,
} from "@/lib/host-site";
import { HostServicesPageView } from "@/components/host-services-page";
import { pageMetadata } from "@/lib/seo";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { hostSlug, pageSlug: rawSlug } = await params;
  const pageSlug = slugify(rawSlug);
  const host = await getHostForGuestSite(hostSlug);
  if (
    !host ||
    !hostServicesPageOn(host) ||
    !pageSlug ||
    HOST_SITE_RESERVED_PATHS.has(pageSlug) ||
    pageSlug !== hostServicesPathSegment(host)
  ) {
    return pageMetadata({
      title: "Page",
      description: "Host page.",
      path: `/h/${encodeURIComponent(hostSlug)}/${encodeURIComponent(rawSlug)}`,
      noIndex: true,
    });
  }
  const label = hostServicesPageLabel(host);
  return pageMetadata({
    title: label,
    description:
      host.siteServicesBody?.slice(0, 160) ||
      `${label} from ${host.name}.`,
    path: `/h/${encodeURIComponent(host.slug)}/${pageSlug}`,
    siteName: host.name,
    image: host.logoUrl,
    imageAlt: host.name,
  });
}

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
  if (!host || !hostServicesPageOn(host)) notFound();

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
