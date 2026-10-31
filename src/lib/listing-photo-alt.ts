/**
 * Meaningful alt text for listing photos: title + caption or photo index.
 */
export function listingPhotoAlt(
  title: string,
  caption?: string | null,
  index = 0,
): string {
  const name = title.trim() || "Listing";
  const rawCap = caption?.trim() || "";
  const n = Math.max(0, Math.floor(index));

  // Seed/stock captions like "Motel exterior placeholder" → "<title> exterior".
  if (/\bplaceholder\b/i.test(rawCap)) {
    const what = /interior|inside|room|bed|kitchen/i.test(rawCap)
      ? "interior"
      : "exterior";
    return n > 0 ? `${name} ${what} (photo ${n + 1})` : `${name} ${what}`;
  }
  const cap = rawCap;

  if (cap && cap.toLowerCase() !== name.toLowerCase()) {
    return n > 0 ? `${name} — ${cap} (photo ${n + 1})` : `${name} — ${cap}`;
  }
  return n > 0 ? `${name}, photo ${n + 1}` : name;
}
