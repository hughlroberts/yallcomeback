/**
 * Focus ring for bonnet "Request to book" / "Reserve" CTAs (E1104-4).
 *
 * WCAG 2.4.7 (Focus Visible) + 1.4.11 (Non-text Contrast): 2px ring with
 * 2px offset. A single color cannot hit ≥3:1 against both the bonnet fill
 * (#3a4a86) and the cream page (#fbf7ef), so we use a dark ring + page-colored
 * offset (the gap is the adjacent color to the button).
 *
 * Contrast (relative luminance, WCAG 2):
 * - ring #171717 vs page/offset buttermilk #fbf7ef → 16.78:1
 * - offset buttermilk #fbf7ef vs button bonnet #3a4a86 → 7.85:1
 * (Direct ring-vs-bonnet is only ~2.1:1 — why inset white failed and why
 * the offset is required.)
 */
export const BOOKING_CTA_FOCUS_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#171717] focus-visible:ring-offset-buttermilk";

export const BOOKING_CTA_FOCUS_CONTRAST = {
  ring: "#171717",
  offset: "#fbf7ef",
  button: "#3a4a86",
  ringVsOffset: 16.78,
  offsetVsButton: 7.85,
} as const;
