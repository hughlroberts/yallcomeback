import { createHmac, timingSafeEqual } from "crypto";
import { marketplaceListingHref } from "@/lib/marketplace-links";

/**
 * T58: short-lived signed preview token for a paused listing, so the host
 * preview opened in a new tab does not depend on the session cookie.
 * Format: <expUnixSeconds>.<base64url hmac(propertyId.exp)>.
 */
export const PREVIEW_TOKEN_TTL_SECONDS = 2 * 60 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is required for preview tokens");
  return s;
}

function sign(propertyId: string, exp: number): string {
  return createHmac("sha256", secret())
    .update(`listing-preview:${propertyId}.${exp}`)
    .digest("base64url");
}

export function createListingPreviewToken(
  propertyId: string,
  nowMs: number = Date.now(),
): string {
  const exp = Math.floor(nowMs / 1000) + PREVIEW_TOKEN_TTL_SECONDS;
  return `${exp}.${sign(propertyId, exp)}`;
}

export function verifyListingPreviewToken(
  token: string | null | undefined,
  propertyId: string,
  nowMs: number = Date.now(),
): boolean {
  if (!token || typeof token !== "string") return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || !sig) return false;
  if (exp * 1000 < nowMs) return false;
  let expected: string;
  try {
    expected = sign(propertyId, exp);
  } catch {
    return false;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Host preview URL for a paused listing: Find a Place page + token. */
export function pausedPreviewHref(
  slug: string,
  hostSlug: string,
  propertyId: string,
  nowMs?: number,
): string {
  const base = marketplaceListingHref(slug, hostSlug);
  return `${base}&preview=${encodeURIComponent(createListingPreviewToken(propertyId, nowMs))}`;
}
