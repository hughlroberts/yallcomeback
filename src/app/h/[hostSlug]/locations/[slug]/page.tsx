import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getHostBySlug } from "@/lib/host";

export const dynamic = "force-dynamic";

/** Legacy host area URL → marketplace search. */
export default async function HostLocationRedirect({
  params,
}: {
  params: Promise<{ hostSlug: string; slug: string }>;
}) {
  const { hostSlug, slug } = await params;
  const host = await getHostBySlug(hostSlug);
  if (!host) notFound();

  const location = await prisma.location.findFirst({
    where: { hostId: host.id, slug, published: true },
    select: { name: true, region: true },
  });
  if (!location) notFound();

  const place = location.region
    ? `${location.name}, ${location.region}`
    : location.name;
  redirect(`/marketplace?where=${encodeURIComponent(place)}`);
}
