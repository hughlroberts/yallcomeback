import type { Metadata } from "next";
import { getHostBySlug } from "@/lib/host";

type Props = {
  children: React.ReactNode;
  params: Promise<{ hostSlug: string }>;
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
  const host = await getHostBySlug(hostSlug);
  if (!host) {
    return { title: "Host not found" };
  }

  const title = host.name;
  const description =
    host.tagline ||
    host.description?.slice(0, 160) ||
    `Book direct with ${host.name}`;

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
      // Prefer host logo when set; else omit so we do not force YCB seal
      ...(host.logoUrl
        ? {
            images: [
              {
                url: host.logoUrl,
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
      ...(host.logoUrl ? { images: [host.logoUrl] } : {}),
    },
    icons: host.logoUrl
      ? {
          icon: [{ url: host.logoUrl }],
          apple: [{ url: host.logoUrl }],
        }
      : undefined,
  };
}

export default async function HostSiteLayout({ children }: Props) {
  return children;
}
