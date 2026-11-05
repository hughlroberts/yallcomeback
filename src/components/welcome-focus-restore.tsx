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

function restoreWelcomeFocus(): boolean {
  try {
    if (sessionStorage.getItem(WELCOME_ESC_FOCUS_KEY) !== "1") return false;
    sessionStorage.removeItem(WELCOME_ESC_FOCUS_KEY);
    const openerId = sessionStorage.getItem(OPENER_KEY) || "";
    sessionStorage.removeItem(OPENER_KEY);

    if (openerId) {
      const opener = document.getElementById(openerId);
      if (opener instanceof HTMLElement) {
        opener.focus({ preventScroll: true });
        return true;
      }
    }

    const logo = document.querySelector<HTMLElement>("a.ycb-logo");
    if (logo) {
      logo.focus({ preventScroll: true });
      return true;
    }
    document.getElementById("ycb-page-top")?.focus({ preventScroll: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * After Esc closes the first-visit dialog (browse → redirect `/`), restore
 * focus to the opener when it still exists; otherwise the header logo / page
 * top so the next Tab starts in the site chrome.
 *
 * The dialog opens on `/` and browse also lands on `/`, so the layout client
 * often stays mounted — poll briefly for the sessionStorage flag instead of
 * relying on a one-shot mount effect.
 */
export function WelcomeFocusRestore() {
  useEffect(() => {
    if (restoreWelcomeFocus()) return;

    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (restoreWelcomeFocus() || tries > 40) {
        window.clearInterval(id);
      }
    }, 50);

    return () => window.clearInterval(id);
  }, []);

  return (
    <span id="ycb-page-top" tabIndex={-1} className="sr-only" aria-hidden />
  );
}
