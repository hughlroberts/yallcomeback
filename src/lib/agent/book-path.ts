import { isYmd } from "@/lib/search-dates";

/** Party size the agent asked for, as the /book page understands it. */
export type BookPathSelection = {
  checkIn?: unknown;
  checkOut?: unknown;
  guests?: unknown;
  pets?: unknown;
};

/** Sanity bound only; the /book page clamps to the listing's own limits. */
const MAX_COUNT = 99;

function wholeNumber(v: unknown, min: number): number | null {
  if (v == null || v === "" || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  if (!Number.isInteger(n) || n < min || n > MAX_COUNT) return null;
  return n;
}

/**
 * Human booking page for a checkout that can't go through (409): the guest
 * can still request the stay or message the host there. The link keeps the
 * request's selection so the page opens on the same stay:
 * - dates only when both are valid YYYY-MM-DD;
 * - guests when a whole number 1–99 (the page caps it at the listing's max
 *   and tells the guest);
 * - pets when a whole number 1–99 (the page drops them if pets aren't allowed).
 * The /book page and agent checkout take only guests and pets for the party,
 * so there are no adults/children/infants params to carry.
 */
export function agentCheckoutBookPath(
  slug: string,
  selection: BookPathSelection = {},
): string | null {
  const s = slug.trim();
  if (!s || !/^[a-z0-9][a-z0-9-]{0,120}$/i.test(s)) return null;
  const params = new URLSearchParams();
  const ci =
    typeof selection.checkIn === "string" ? selection.checkIn.trim() : "";
  const co =
    typeof selection.checkOut === "string" ? selection.checkOut.trim() : "";
  if (isYmd(ci) && isYmd(co)) {
    params.set("checkIn", ci);
    params.set("checkOut", co);
  }
  const guests = wholeNumber(selection.guests, 1);
  if (guests != null) params.set("guests", String(guests));
  const pets = wholeNumber(selection.pets, 1);
  if (pets != null) params.set("pets", String(pets));
  const q = params.toString();
  return `/book/${encodeURIComponent(s)}${q ? `?${q}` : ""}`;
}
