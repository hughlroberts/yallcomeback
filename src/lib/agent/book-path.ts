import { isYmd } from "@/lib/search-dates";

/**
 * Human booking page for a checkout that can't go through (409): the guest
 * can still request the stay or message the host there. Dates are kept only
 * when both are valid YYYY-MM-DD.
 */
export function agentCheckoutBookPath(
  slug: string,
  checkIn?: string,
  checkOut?: string,
): string | null {
  const s = slug.trim();
  if (!s || !/^[a-z0-9][a-z0-9-]{0,120}$/i.test(s)) return null;
  const ci = (checkIn || "").trim();
  const co = (checkOut || "").trim();
  const q = isYmd(ci) && isYmd(co) ? `?checkIn=${ci}&checkOut=${co}` : "";
  return `/book/${encodeURIComponent(s)}${q}`;
}
