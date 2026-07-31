import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostBySlug } from "@/lib/host";

export const dynamic = "force-dynamic";

/**
 * Host-site property URL.
 * Booking UI lives on the shared listing page (calendar + reserve).
 * Tenant chrome still applies via x-tenant-slug on custom domains, so guests
 * stay in the host brand while completing the book flow.
 */
export default async function HostPropertyPage({
  params,
}: {
  params: Promise<{ hostSlug: string; slug: string }>;
}) {
  const { hostSlug, slug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();

  const property = await prisma.property.findFirst({
    where: { hostId: host.id, slug, published: true },
    select: { slug: true },
  });
  if (!property) notFound();

  // Preserve host brand context for chrome + attribution
  redirect(
    `/marketplace/properties/${property.slug}?host=${host.slug}&via=host_site#reserve`,
  );
}
