"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const CLEAR_PARAMS = [
  "subscribed",
  "session_id",
  "canceled",
  "welcome",
  "upgraded",
] as const;

/**
 * Centered confirmation popup. Auto-dismisses and strips flash query params
 * so a refresh does not bring it back.
 */
export function FlashToast({
  title,
  body,
  variant = "success",
  durationMs = 6500,
}: {
  title: string;
  body: string;
  variant?: "success" | "info" | "warn";
  durationMs?: number;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of CLEAR_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
    const t = window.setTimeout(() => setOpen(false), durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs]);

  if (!open) return null;

  const ring =
    variant === "warn"
      ? "ring-amber-200"
      : variant === "info"
        ? "ring-stone-200"
        : "ring-emerald-200";
  const titleColor =
    variant === "warn"
      ? "text-amber-950"
      : variant === "info"
        ? "text-stone-900"
        : "text-emerald-950";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center px-4 pt-[14vh] sm:pt-[18vh]"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/25"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
      />
      <div
        className={`relative w-full max-w-md rounded-2xl bg-white p-5 shadow-xl ring-1 ${ring}`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden />
        </button>
        <p className={`pr-8 text-base font-semibold ${titleColor}`}>{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{body}</p>
      </div>
    </div>
  );
}
