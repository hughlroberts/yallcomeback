import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { PRODUCT_ORIGIN } from "@/lib/features";
import { HELP_ARTICLES, helpPath } from "@/lib/help";
import {
  MARKETPLACE_EXCLUDED_HOST_SLUGS,
  marketplacePropertyWhere,
} from "@/lib/host";
import { HOSTING_PUBLIC_STATUSES } from "@/lib/hosting";
import { isAgentApiEnabled } from "@/lib/platform-features";
import { listingCanonicalPath } from "@/lib/site-url";
import { hostSitemapEntries } from "@/lib/host-meta";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    PRODUCT_ORIGIN;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/marketplace`, changeFrequency: "hourly", priority: 0.95 },
    { url: `${base}/for-hosts`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/open-source`, changeFrequency: "monthly", priority: 0.55 },
    { url: `${base}/self-host`, changeFrequency: "monthly", priority: 0.55 },
    { url: `${base}/help`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
    ...HELP_ARTICLES.map((article): MetadataRoute.Sitemap[number] => ({
      url: `${base}${helpPath(article.slug)}`,
      changeFrequency: "monthly",
      priority: 0.45,
    })),
    ...(isAgentApiEnabled()
      ? ([
          {
            url: `${base}/llms.txt`,
            changeFrequency: "weekly",
            priority: 0.8,
          },
          {
            url: `${base}/agents.md`,
            changeFrequency: "weekly",
            priority: 0.8,
          },
          {
            url: `${base}/api/v1/openapi.json`,
            changeFrequency: "weekly",
            priority: 0.75,
          },
        ] as MetadataRoute.Sitemap)
      : []),
  ];

  let listings: MetadataRoute.Sitemap = [];
  try {
    const props = await prisma.property.findMany({
      where: {
        ...marketplacePropertyWhere(),
        // E1104-D4: QA / test brands stay out of the public sitemap.
        host: {
          ...marketplacePropertyWhere().host,
          isTestBrand: false,
        },
      },
      select: {
        slug: true,
        updatedAt: true,
        host: { select: { slug: true } },
      },
      take: 2000,
      orderBy: { updatedAt: "desc" },
    });
    listings = props.map((p) => ({
      url: `${base}${listingCanonicalPath(p.slug)}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.85,
    }));
  } catch {
    // Build/DB unavailable — static routes only
  }

  let hostPages: MetadataRoute.Sitemap = [];
  try {
    const hosts = await prisma.host.findMany({
      where: {
        active: true,
        approvalStatus: "APPROVED",
        sitePublishState: { in: ["DEMO", "LIVE"] },
        slug: { notIn: [...MARKETPLACE_EXCLUDED_HOST_SLUGS] },
        // E1104-D4: never sitemap test brands (real hosts untouched).
        isTestBrand: false,
        OR: [
          { hostingMode: "SELF" },
          {
            hostingMode: "PLATFORM",
            subscriptionStatus: { in: [...HOSTING_PUBLIC_STATUSES] },
          },
        ],
      },
      select: { slug: true, updatedAt: true, sitePageAbout: true },
      take: 2000,
      orderBy: { updatedAt: "desc" },
    });
    hostPages = hosts.flatMap((h) => hostSitemapEntries(base, h));
  } catch {
    // Build/DB unavailable
  }

  return [...staticRoutes, ...listings, ...hostPages];
}
