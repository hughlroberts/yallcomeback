import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import {
  hostServicesHref,
  hostServicesPageLabel,
  hostServicesPathSegment,
} from "@/lib/host-site";
import { HostServicesPageView } from "@/components/host-services-page";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}): Promise<Metadata> {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host || !host.sitePageServices) {
    return pageMetadata({
      title: "Services",
      description: "Host services.",
      path: `/h/${encodeURIComponent(hostSlug)}/services`,
      noIndex: true,
    });
  }
  const label = hostServicesPageLabel(host);
  const segment = hostServicesPathSegment(host);
  return pageMetadata({
    title: label,
    description:
      host.siteServicesBody?.slice(0, 160) ||
      `${label} from ${host.name}.`,
    path: `/h/${encodeURIComponent(host.slug)}/${segment}`,
    siteName: host.name,
    image: host.logoUrl,
    imageAlt: host.name,
  });
}

/**
 * Legacy / default path: /h/{slug}/services
 * Redirects to the host’s chosen public path when different (e.g. /boat-rentals).
 */
export default async function HostServicesPage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host || !host.sitePageServices) notFound();

  const segment = hostServicesPathSegment(host);
  if (segment !== "services") {
    const base = await hostPublicBasePath(host.slug);
    redirect(hostServicesHref(host, base));
  }

  return <HostServicesPageView host={host} />;
}
