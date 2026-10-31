/**
 * Unique, listing-specific meta description.
 * Sibling listings (e.g. kitchenette-1 / kitchenette-2) often share a tagline,
 * so we always lead with distinct facts: title, sleeps/beds, place, host.
 */
export type ListingMetaInput = {
  title: string;
  tagline?: string | null;
  description?: string | null;
  city?: string | null;
  region?: string | null;
  maxGuests?: number | null;
  beds?: number | null;
  bedrooms?: number | null;
  hostName?: string | null;
};

const MAX = 160;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function listingMetaDescription(p: ListingMetaInput): string {
  const title = p.title.trim() || "Listing";
  const place = [p.city, p.region]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");

  const facts: string[] = [];
  if (p.maxGuests && p.maxGuests > 0) facts.push(`sleeps ${p.maxGuests}`);
  if (p.beds && p.beds > 0) facts.push(plural(p.beds, "bed"));
  else if (p.bedrooms && p.bedrooms > 0) facts.push(plural(p.bedrooms, "bedroom"));

  let head = title;
  if (place) head += ` in ${place}`;
  if (facts.length) head += ` · ${facts.join(", ")}`;
  const host = p.hostName?.trim();
  if (host) head += ` · hosted by ${host}`;
  head += ".";

  const blurb = (p.tagline?.trim() || p.description?.trim() || "").replace(
    /\s+/g,
    " ",
  );
  const fallback = host ? `Book direct with ${host}.` : "Book direct.";
  const tail = blurb || fallback;

  const full = `${head} ${tail}`;
  if (full.length <= MAX) return full;
  if (head.length >= MAX - 1) return `${head.slice(0, MAX - 1).trimEnd()}…`;
  const room = MAX - head.length - 2; // space + ellipsis
  if (room < 12) return head;
  return `${head} ${tail.slice(0, room).trimEnd()}…`;
}
