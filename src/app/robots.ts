import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://yallcomeback.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/", "/llms.txt", "/agents.md", "/marketplace"],
        disallow: [
          "/admin",
          "/ops",
          "/api/admin",
          "/api/cron",
          "/api/stripe",
          "/account",
          "/messages",
          "/login",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
