import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostForGuestSite } from "@/lib/host";
import { hostPublicBasePath } from "@/lib/host-base-path";

export const dynamic = "force-dynamic";

/** Legacy host area URL → host stays (do not bounce to YCB marketplace). */
export default async function HostLocationRedirect({
  params,
}: {
  params: Promise<{ hostSlug: string; slug: string }>;
}) {
  const { hostSlug, slug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host) notFound();

  const location = await prisma.location.findFirst({
    where: { hostId: host.id, slug, published: true },
    select: { id: true },
  });
  if (!location) notFound();

  const base = await hostPublicBasePath(host.slug);
  redirect(`${base}/stays`);
}
