import type { Metadata } from "next";
import { getHostForGuestSite } from "@/lib/host";
import { pageMetadata } from "@/lib/seo";

type Props = {
  children: React.ReactNode;
  params: Promise<{ hostSlug: string }>;
};

/**
 * Optional dedicated tab icons (small mark). Full seal stays for OG/logo.
 * Files live under public/brand/hosts/{slug}-favicon.png
 */
const HOST_FAVICONS: Record<string, string> = {
  "cherokee-landing": "/brand/hosts/cherokee-landing-favicon.png",
};

/**
 * Host microsite metadata — title/description/OG use host brand, not YCB.
 * Each host path gets its own canonical and og:url.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}): Promise<Metadata> {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host) {
    return pageMetadata({
      title: "Host not found",
      description: "This host site is not available.",
      path: `/h/${encodeURIComponent(hostSlug)}`,
      noIndex: true,
    });
  }

  const title = host.name;
  const description =
    host.tagline ||
    host.description?.slice(0, 160) ||
    `Stay again with ${host.name}`;

  const faviconUrl =
    HOST_FAVICONS[host.slug] || host.logoUrl || undefined;
  const ogImage = host.logoUrl || faviconUrl || undefined;

  const base = pageMetadata({
    title,
    description,
    path: `/h/${encodeURIComponent(host.slug)}`,
    absoluteTitle: true,
    siteName: host.name,
    image: ogImage,
    imageAlt: host.name,
    twitterCard: ogImage ? "summary" : "summary_large_image",
  });

  return {
    ...base,
    title: {
      default: title,
      template: `%s · ${host.name}`,
    },
    applicationName: host.name,
    icons: faviconUrl
      ? {
          icon: [{ url: faviconUrl, type: "image/png" }],
          apple: [{ url: faviconUrl }],
          shortcut: faviconUrl,
        }
      : undefined,
  };
}

export default async function HostSiteLayout({ children }: Props) {
  return children;
}
