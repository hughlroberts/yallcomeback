import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Legacy area/destination pages. Guests search by place on the marketplace now.
 */
export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const location = await prisma.location.findFirst({
    where: { slug, published: true },
    select: { name: true, city: true },
  });
  if (!location) notFound();

  const place = location.city || location.name;
  redirect(`/marketplace?where=${encodeURIComponent(place)}`);
}
