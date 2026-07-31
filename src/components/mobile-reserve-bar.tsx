"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/utils";

type Props = {
  nightlyRate: number;
  currencySymbol?: string;
  /** Element id of the full reserve card (default #reserve) */
  targetId?: string;
};

/**
 * Sticky bottom bar on phone/tablet portrait when the main reserve card is off-screen.
 * Hidden from lg up (desktop side card). Desktop unchanged.
 */
export function MobileReserveBar({
  nightlyRate,
  currencySymbol = "$",
  targetId = "reserve",
}: Props) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        // Hide bar when the full reserve card is visible
        setShow(!entry?.isIntersecting);
      },
      {
        // Account for sticky header
        rootMargin: "-80px 0px 0px 0px",
        threshold: 0.12,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  function scrollToReserve() {
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Focus first interactive control if present
      const focusable = el.querySelector<HTMLElement>(
        "button, [href], input, select, textarea",
      );
      focusable?.focus({ preventScroll: true });
    }
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[150] border-t border-stone-200/90 bg-white/95 shadow-[0_-8px_30px_rgba(42,53,102,0.12)] backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-base font-semibold tabular-nums text-stone-900">
            {formatMoney(nightlyRate, currencySymbol)}
            <span className="text-sm font-normal text-stone-500"> night</span>
          </p>
          <p className="truncate text-xs text-stone-500">Select dates to book</p>
        </div>
        <button
          type="button"
          onClick={scrollToReserve}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-semibold text-white hover:bg-bonnet-hover active:bg-bonnet-active"
        >
          Reserve
        </button>
      </div>
    </div>
  );
}
