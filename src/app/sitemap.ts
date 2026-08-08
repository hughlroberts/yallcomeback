import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://yallcomeback.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/marketplace`, changeFrequency: "hourly", priority: 0.95 },
    { url: `${base}/for-hosts`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/llms.txt`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/agents.md`, changeFrequency: "weekly", priority: 0.8 },
    {
      url: `${base}/api/v1/openapi.json`,
      changeFrequency: "weekly",
      priority: 0.75,
    },
  ];

  let listings: MetadataRoute.Sitemap = [];
  try {
    const props = await prisma.property.findMany({
      where: marketplacePropertyWhere(),
      select: {
        slug: true,
        updatedAt: true,
        host: { select: { slug: true } },
      },
      take: 2000,
      orderBy: { updatedAt: "desc" },
    });
    listings = props.map((p) => ({
      url: `${base}/marketplace/properties/${p.slug}?host=${encodeURIComponent(p.host.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.85,
    }));
  } catch {
    // Build/DB unavailable — static routes only
  }

  return [...staticRoutes, ...listings];
}
