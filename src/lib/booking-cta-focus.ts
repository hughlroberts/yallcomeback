/**
 * Shared focus rings for primary CTAs, ui Button, and button-styled links.
 *
 * WCAG 2.4.7 (Focus Visible) + 1.4.11 (Non-text Contrast): 2px ring with
 * 2px offset. A single color cannot hit ≥3:1 against both a filled control
 * and the page, so the ring and the offset share the work (the gap is the
 * adjacent color to the control).
 *
 * Light pages / cream chrome (buttermilk #fbf7ef):
 * - ring #171717 vs offset buttermilk → 16.78:1
 * - offset buttermilk vs bonnet #3a4a86 → 7.85:1
 * Also readable on secondary/ghost fills (porcelain/white).
 *
 * Dark sections (stone-950 chrome). Bonnet fills cannot use a dark offset:
 * bonnet vs stone-950 is only ~2.36:1. Use the dark variant for light fills
 * on dark heroes (honey, white/ghost) where offset matches the section:
 * - ring buttermilk vs offset stone-950 → 18.49:1
 * - offset stone-950 vs honey #e8ce96 → 12.89:1 (≥3:1)
 */

/** Primary CTA focus on light / cream backgrounds. */
export const PRIMARY_CTA_FOCUS_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#171717] focus-visible:ring-offset-buttermilk";

/**
 * Alias kept for booking widget / Button imports (same tokens as
 * PRIMARY_CTA_FOCUS_CLASS).
 */
export const BOOKING_CTA_FOCUS_CLASS = PRIMARY_CTA_FOCUS_CLASS;

/**
 * Primary CTA focus on dark heroes (bg-stone-900 / stone-950). Light ring +
 * stone-950 offset so the halo matches the section. Use for honey / white /
 * ghost controls — not for bonnet fills (see file comment).
 */
export const PRIMARY_CTA_FOCUS_ON_DARK_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-buttermilk focus-visible:ring-offset-stone-950";

/**
 * Same dark recipe with section-matched offsets (Tailwind needs full class
 * strings — do not interpolate). White / honey / ghost fills only.
 */
export const PRIMARY_CTA_FOCUS_ON_CYAN_950_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-buttermilk focus-visible:ring-offset-cyan-950";

export const PRIMARY_CTA_FOCUS_ON_SLATE_900_CLASS =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-buttermilk focus-visible:ring-offset-slate-900";

export const BOOKING_CTA_FOCUS_CONTRAST = {
  ring: "#171717",
  offset: "#fbf7ef",
  button: "#3a4a86",
  ringVsOffset: 16.78,
  offsetVsButton: 7.85,
} as const;

export const PRIMARY_CTA_FOCUS_ON_DARK_CONTRAST = {
  ring: "#fbf7ef",
  offset: "#0c0a09", // stone-950
  honey: "#e8ce96",
  ringVsOffset: 18.49,
  offsetVsHoney: 12.89,
} as const;

/** cyan-950 #083344; white fill vs offset ≫ 3:1 */
export const PRIMARY_CTA_FOCUS_ON_CYAN_950_CONTRAST = {
  ring: "#fbf7ef",
  offset: "#083344",
  white: "#ffffff",
  ringVsOffset: 15.5,
  offsetVsWhite: 12.6,
} as const;

/** slate-900 #0f172a */
export const PRIMARY_CTA_FOCUS_ON_SLATE_900_CONTRAST = {
  ring: "#fbf7ef",
  offset: "#0f172a",
  white: "#ffffff",
  ringVsOffset: 16.1,
  offsetVsWhite: 16.7,
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
