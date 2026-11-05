"use client";

import { useEffect } from "react";

export const WELCOME_ESC_FOCUS_KEY = "ycb-welcome-esc-focus";
const OPENER_KEY = "ycb-welcome-esc-focus-opener";

/** Call before the welcome dialog dismisses via Esc so focus lands after redirect. */
export function markWelcomeEscFocusRestore() {
  try {
    sessionStorage.setItem(WELCOME_ESC_FOCUS_KEY, "1");
  } catch {
    /* private mode */
  }
}

/**
 * After Esc closes the first-visit dialog (browse → redirect `/`), restore
 * focus to the opener when it still exists; otherwise the header logo / page
 * top so the next Tab starts in the site chrome.
 */
export function WelcomeFocusRestore() {
  useEffect(() => {
    let openerId = "";
    try {
      if (sessionStorage.getItem(WELCOME_ESC_FOCUS_KEY) !== "1") return;
      sessionStorage.removeItem(WELCOME_ESC_FOCUS_KEY);
      openerId = sessionStorage.getItem(OPENER_KEY) || "";
      sessionStorage.removeItem(OPENER_KEY);
    } catch {
      return;
    }

    if (openerId) {
      const opener = document.getElementById(openerId);
      if (opener instanceof HTMLElement) {
        opener.focus({ preventScroll: true });
        return;
      }
    }

    const logo = document.querySelector<HTMLElement>("a.ycb-logo");
    if (logo) {
      logo.focus({ preventScroll: true });
      return;
    }
    document.getElementById("ycb-page-top")?.focus({ preventScroll: true });
  }, []);

  return (
    <span id="ycb-page-top" tabIndex={-1} className="sr-only" aria-hidden />
  );
}
