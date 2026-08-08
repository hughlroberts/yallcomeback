import type { MetadataRoute } from "next";

/** Runtime env — do not prerender with build-time fallback host. */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://yallcomeback.com";

  // robots Host should be hostname only when provided
  let hostName: string | undefined;
  try {
    hostName = new URL(base).host;
  } catch {
    hostName = undefined;
  }

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
    ...(hostName ? { host: hostName } : {}),
  };
}
