/**
 * Shared focus ring for primary CTAs and the ui Button (N1 / E1104-4).
 *
 * WCAG 2.4.7 (Focus Visible) + 1.4.11 (Non-text Contrast): 2px ring with
 * 2px offset. A single color cannot hit ≥3:1 against both the bonnet fill
 * (#3a4a86) and the cream page (#fbf7ef), so we use a dark ring + page-colored
 * offset (the gap is the adjacent color to the button).
 *
 * Contrast (relative luminance, WCAG 2):
 * - ring #171717 vs page/offset buttermilk #fbf7ef → 16.78:1
 * - offset buttermilk #fbf7ef vs button bonnet #3a4a86 → 7.85:1
 * Also readable on light Button variants (secondary/ghost/danger): ring vs
 * porcelain/white ≥ 17:1.
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

/** Move focus to the inline listing #reserve book button (not Guests/Pets). */
export function focusInlineReserveCta(targetId = "reserve"): boolean {
  if (typeof document === "undefined") return false;
  const root = document.getElementById(targetId);
  if (!root) return false;
  const footerBtn = root.querySelector<HTMLElement>(
    '[data-testid="booking-card-footer"] button',
  );
  if (footerBtn) {
    footerBtn.focus({ preventScroll: true });
    return true;
  }
  const named = [...root.querySelectorAll<HTMLElement>("button")].find((b) =>
    /Request to book|Reserve/i.test(b.textContent || ""),
  );
  if (named) {
    named.focus({ preventScroll: true });
    return true;
  }
  return false;
}
