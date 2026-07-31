import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostBySlug } from "@/lib/host";

export const dynamic = "force-dynamic";

/** Host-site property URLs use the marketplace listing (reserve card has calendar). */
export default async function HostPropertyPageRedirect({
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

  redirect(
    `/marketplace/properties/${property.slug}?host=${host.slug}#reserve`,
  );
}
