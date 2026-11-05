import type { Metadata } from "next";
import {
  PRODUCT_NAME,
  PRODUCT_ORIGIN,
  PRODUCT_TAGLINE,
  canonicalSiteOrigin,
} from "@/lib/features";

/** Default OG/Twitter image routes (Next.js ImageResponse handlers). */
export const DEFAULT_OG_IMAGE = "/opengraph-image";
export const DEFAULT_TWITTER_IMAGE = "/twitter-image";

/** Public site origin for canonical and social tags. */
export function seoOrigin(): string {
  try {
    return canonicalSiteOrigin().replace(/\/$/, "") || PRODUCT_ORIGIN;
  } catch {
    return PRODUCT_ORIGIN;
  }
}

/**
 * Absolute public URL for a path (path may include a query string).
 * `"/"` → `https://www.yallcomeback.app/`
 */
export function seoAbsoluteUrl(path: string): string {
  const origin = seoOrigin();
  if (!path || path === "/") return `${origin}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

export type PageMetadataInput = {
  /** Document title segment (template adds `· ${siteName}` unless absoluteTitle). */
  title: string;
  description: string;
  /** Pathname (+ optional query), e.g. `/about` or `/marketplace/properties/x?host=y`. */
  path: string;
  /** Use full title with no layout template (homepage). */
  absoluteTitle?: boolean;
  /** OG/Twitter image path or absolute URL. */
  image?: string | null;
  imageAlt?: string;
  /** Real pixel size of `image` when known (listing photos). */
  imageWidth?: number;
  imageHeight?: number;
  /** openGraph.siteName override (host microsites). */
  siteName?: string;
  type?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  noIndex?: boolean;
};

/** Turn a site-relative or absolute image into an absolute URL for OG scrapers. */
export function seoAbsoluteImageUrl(image: string): string {
  const s = image.trim();
  if (!s) return seoAbsoluteUrl(DEFAULT_OG_IMAGE);
  if (/^https?:\/\//i.test(s)) return s;
  return seoAbsoluteUrl(s.startsWith("/") ? s : `/${s}`);
}

/**
 * Full public-page metadata: unique title/description, canonical, og:url,
 * and real Open Graph + Twitter tags (not root defaults alone).
 */
export function pageMetadata(opts: PageMetadataInput): Metadata {
  const siteName = opts.siteName?.trim() || PRODUCT_NAME;
  const description = (opts.description || PRODUCT_TAGLINE).trim().slice(0, 320);
  const canonical = seoAbsoluteUrl(opts.path);
  const rawImage = (opts.image && opts.image.trim()) || DEFAULT_OG_IMAGE;
  const isDefaultOg = rawImage === DEFAULT_OG_IMAGE;
  const image = seoAbsoluteImageUrl(rawImage);
  const titleText = opts.title.trim() || siteName;
  const displayTitle = opts.absoluteTitle
    ? titleText
    : titleText.includes(siteName)
      ? titleText
      : `${titleText} · ${siteName}`;
  const imageAlt =
    opts.imageAlt?.trim() || `${displayTitle}`;

  // E1104-D6: only claim dimensions we know. Default OG card is 1200×630;
  // listing photos pass real width/height (or omit rather than lie).
  const width =
    opts.imageWidth && opts.imageWidth > 0
      ? opts.imageWidth
      : isDefaultOg
        ? 1200
        : undefined;
  const height =
    opts.imageHeight && opts.imageHeight > 0
      ? opts.imageHeight
      : isDefaultOg
        ? 630
        : undefined;

  const ogImages = [
    {
      url: image,
      ...(width != null && height != null ? { width, height } : {}),
      alt: imageAlt,
    },
  ];

  const twitterImage = isDefaultOg
    ? seoAbsoluteImageUrl(DEFAULT_TWITTER_IMAGE)
    : image;

  return {
    title: opts.absoluteTitle ? { absolute: titleText } : titleText,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: opts.type || "website",
      locale: "en_US",
      siteName,
      url: canonical,
      title: displayTitle,
      description,
      images: ogImages,
    },
    twitter: {
      card: opts.twitterCard || "summary_large_image",
      title: displayTitle,
      description,
      images: [twitterImage],
    },
    ...(opts.noIndex
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}

/** T27: home title ~50-60 chars, description ~140-160 chars. */
export const HOME_TITLE = `${PRODUCT_NAME} · Book Vacation Rentals Direct from Hosts`;
export const HOME_DESCRIPTION = `Book vacation rentals directly with the host on ${PRODUCT_NAME}. Search stays, check real calendars and prices, and come back to a host you already know.`;

/** Homepage metadata (absolute title, root canonical). */
export function homePageMetadata(): Metadata {
  return pageMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    absoluteTitle: true,
    imageAlt: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
  });
}
