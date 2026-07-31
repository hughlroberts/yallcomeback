import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostBySlug } from "@/lib/host";

export const dynamic = "force-dynamic";

/**
 * Host microsites are retired. Send visitors to marketplace stays for this host.
 */
export default async function HostSiteHomePage({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}) {
  const { hostSlug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();

  const firstListing = await prisma.property.findFirst({
    where: {
      hostId: host.id,
      published: true,
      listOnMarketplace: true,
    },
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    select: { slug: true },
  });

  if (firstListing) {
    redirect(
      `/marketplace/properties/${firstListing.slug}?host=${host.slug}`,
    );
  }

  redirect(`/marketplace?q=${encodeURIComponent(host.name)}`);
}
