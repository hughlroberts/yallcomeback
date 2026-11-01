"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, X } from "lucide-react";

/**
 * Confirmation pinned to the bottom of the viewport (above the iOS home
 * bar), so it is visible after a sheet closes no matter where the page is
 * scrolled. Auto-hides; tap X to dismiss sooner. No overlay, so the
 * calendar stays usable underneath.
 */
export function SaveToast({
  message,
  onDismiss,
  durationMs = 5000,
}: {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [message, onDismiss, durationMs]);

  // Nothing renders until a save (message is null on the server), and the
  // portal keeps position:fixed relative to the viewport, not a transformed
  // ancestor.
  if (!message || typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[320] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-xl ring-1 ring-emerald-900/20">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 break-words">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-emerald-100 hover:bg-emerald-800 hover:text-white"
          aria-label="Dismiss"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  );
}
