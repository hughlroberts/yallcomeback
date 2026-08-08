import type { Metadata } from "next";
import { getHostForGuestSite } from "@/lib/host";

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
 * (Root layout still supplies platform defaults when host is unknown.)
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ hostSlug: string }>;
}): Promise<Metadata> {
  const { hostSlug } = await params;
  const host = await getHostForGuestSite(hostSlug);
  if (!host) {
    return { title: "Host not found" };
  }

  const title = host.name;
  const description =
    host.tagline ||
    host.description?.slice(0, 160) ||
    `Book direct with ${host.name}`;

  const faviconUrl =
    HOST_FAVICONS[host.slug] || host.logoUrl || undefined;
  const ogImage = host.logoUrl || faviconUrl;

  return {
    title: {
      default: title,
      template: `%s · ${host.name}`,
    },
    description,
    applicationName: host.name,
    openGraph: {
      title,
      description,
      siteName: host.name,
      type: "website",
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                alt: host.name,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
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
