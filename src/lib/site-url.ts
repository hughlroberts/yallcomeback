import { headers } from "next/headers";
import { canonicalSiteOrigin, isLocalHostname } from "@/lib/features";

/**
 * Absolute origin for links (QR codes, emails, iCal).
 * Live site only — never localhost.
 */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv = canonicalSiteOrigin();
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host =
    h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  if (host && !isLocalHostname(host)) return `${proto}://${host}`;
  return canonicalSiteOrigin();
}

/** Public guest URL for a listing on Yall Come Back marketplace. */
export function listingPublicPath(slug: string, hostSlug: string): string {
  return `/marketplace/properties/${slug}?host=${encodeURIComponent(hostSlug)}`;
}

/** Canonical listing URL path (no query string) for canonical, og:url, sitemap. */
export function listingCanonicalPath(slug: string): string {
  return `/marketplace/properties/${encodeURIComponent(slug)}`;
}

/**
 * Internal marketplace link to a listing. Uses the clean canonical path
 * (no ?host=) unless another marketplace host uses the same property slug,
 * in which case ?host= is still needed to pick the right listing.
 */
export function marketplaceListingHref(
  slug: string,
  hostSlug: string,
  ambiguousSlugs: ReadonlySet<string>,
): string {
  return ambiguousSlugs.has(slug)
    ? listingPublicPath(slug, hostSlug)
    : listingCanonicalPath(slug);
}

/** Where a fridge-magnet QR should open. */
export type MagnetLinkTarget = "marketplace" | "host";

/**
 * Absolute URL encoded in the fridge magnet QR.
 * - marketplace → YCB listing page (platform origin)
 * - host → host’s own website / custom domain listing path when configured
 */
export function magnetListingUrl(opts: {
  target: MagnetLinkTarget;
  platformOrigin: string;
  propertySlug: string;
  hostSlug: string;
  /** Host brand website, e.g. https://www.cherokeelanding.net */
  hostWebsiteUrl?: string | null;
}): string {
  const { target, platformOrigin, propertySlug, hostSlug, hostWebsiteUrl } =
    opts;

  if (target === "marketplace") {
    return `${platformOrigin.replace(/\/$/, "")}${listingPublicPath(propertySlug, hostSlug)}`;
  }

  const raw = hostWebsiteUrl?.trim() || "";
  if (raw) {
    try {
      const base = new URL(raw.includes("://") ? raw : `https://${raw}`);
      // Host-native listing path on their domain (middleware → booking flow)
      return `${base.origin}/properties/${encodeURIComponent(propertySlug)}`;
    } catch {
      // fall through
    }
  }

  // No website configured — host-branded path on the platform app
  return `${platformOrigin.replace(/\/$/, "")}/h/${encodeURIComponent(hostSlug)}/properties/${encodeURIComponent(propertySlug)}`;
}

export function parseMagnetLinkTarget(
  raw: string | null | undefined,
): MagnetLinkTarget {
  return raw === "host" ? "host" : "marketplace";
}
