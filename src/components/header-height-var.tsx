"use client";

import { useEffect, useRef } from "react";
import { SITE_HEADER_HEIGHT_VAR } from "@/lib/sticky-offset";

/**
 * Publishes the sticky site header's real height as a CSS variable on <html>
 * so sticky elements (the listing booking card) sit just below it, even when
 * the header grows (signed-in nav, a taller logo, wrapped links).
 * Render it inside the <header>.
 */
export function HeaderHeightVar() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const header = ref.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty(
        SITE_HEADER_HEIGHT_VAR,
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(header);
    return () => {
      ro.disconnect();
      root.style.removeProperty(SITE_HEADER_HEIGHT_VAR);
    };
  }, []);
  return <span ref={ref} hidden aria-hidden="true" />;
}
