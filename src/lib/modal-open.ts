import { useEffect } from "react";

/**
 * Tracks how many full-screen dialogs are open so fixed page chrome (the
 * mobile "Request to book" bar) can step aside. Without this, the bar's
 * z-index sat above dialogs and swallowed taps on their bottom buttons.
 */
let openCount = 0;
const listeners = new Set<() => void>();

function emit() {
  if (typeof document !== "undefined") {
    if (openCount > 0) document.documentElement.dataset.modalOpen = "true";
    else delete document.documentElement.dataset.modalOpen;
  }
  for (const l of listeners) l();
}

export function openModal(): () => void {
  openCount += 1;
  emit();
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openCount = Math.max(0, openCount - 1);
    emit();
  };
}

export function subscribeModalOpen(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isAnyModalOpen(): boolean {
  return openCount > 0;
}

export function isAnyModalOpenServer(): boolean {
  return false;
}

/** Register a dialog as open while `open` is true. */
export function useModalOpen(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    return openModal();
  }, [open]);
}
