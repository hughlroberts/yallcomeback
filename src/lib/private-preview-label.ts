/** Admin label for the signed paused-listing preview link. The signed URL
 * works signed out until it expires (PREVIEW_TOKEN_TTL_SECONDS = 2 h), so we
 * must not claim "only you can see it". */
export const PRIVATE_PREVIEW_LABEL = "Private preview (link works for 2 hours)";

/** Banner sentence on the paused-listing preview page (same 2 h signed link). */
export const PRIVATE_PREVIEW_BANNER_NOTE =
  "Private preview. Guests can't find this listing while it's paused. Anyone with this link can view it for 2 hours.";
