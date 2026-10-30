/**
 * Meaningful alt text for listing photos: title + caption or photo index.
 */
export function listingPhotoAlt(
  title: string,
  caption?: string | null,
  index = 0,
): string {
  const name = title.trim() || "Listing";
  const cap = caption?.trim() || "";
  const n = Math.max(0, Math.floor(index));

  if (cap && cap.toLowerCase() !== name.toLowerCase()) {
    return n > 0 ? `${name} — ${cap} (photo ${n + 1})` : `${name} — ${cap}`;
  }
  return n > 0 ? `${name}, photo ${n + 1}` : name;
}
