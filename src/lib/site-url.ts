import { headers } from "next/headers";

/**
 * Absolute origin for links (QR codes, emails, iCal).
 * Prefers env, then request headers.
 */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host =
    h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}

/** Public guest URL for a listing (scan → book again). */
export function listingPublicPath(slug: string, hostSlug: string): string {
  return `/marketplace/properties/${slug}?host=${encodeURIComponent(hostSlug)}`;
}
