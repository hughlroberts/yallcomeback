import { createHmac, timingSafeEqual } from "crypto";

/**
 * Unauthenticated confirmation links use an HMAC access token so booking IDs
 * alone cannot leak guest PII (email, phone, payment details).
 */
function secret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is required for booking access tokens");
  return s;
}

export function bookingAccessToken(bookingId: string): string {
  return createHmac("sha256", secret())
    .update(`booking-confirm:${bookingId}`)
    .digest("hex")
    .slice(0, 32);
}

export function verifyBookingAccessToken(
  bookingId: string,
  token: string | null | undefined,
): boolean {
  if (!token || token.length < 16) return false;
  try {
    const expected = bookingAccessToken(bookingId);
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
