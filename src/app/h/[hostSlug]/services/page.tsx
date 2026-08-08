import { notFound, redirect } from "next/navigation";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";
import {
  hostServicesHref,
  hostServicesPathSegment,
} from "@/lib/host-site";
import { HostServicesPageView } from "@/components/host-services-page";

export const dynamic = "force-dynamic";

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
