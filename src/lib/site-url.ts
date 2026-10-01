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
