import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Legacy/global property URL → marketplace listing */
export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ host?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const property = await prisma.property.findFirst({
    where: {
      slug,
      published: true,
      ...(sp.host ? { host: { slug: sp.host } } : {}),
    },
    include: { host: true },
  });

  if (!property) notFound();

  redirect(
    `/marketplace/properties/${property.slug}?host=${property.host.slug}`,
  );
}
