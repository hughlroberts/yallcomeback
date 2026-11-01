"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { shouldResetScroll } from "@/lib/route-scroll";

/**
 * Scroll to the top on every route change (see shouldResetScroll).
 * Mounted once in the root layout so marketplace, host custom domains,
 * and /admin all behave the same.
 */
export function RouteScrollReset() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const backForward = useRef(false);

  useEffect(() => {
    // popstate fires before the router renders the old route.
    const onPop = () => {
      backForward.current = true;
    };
    // Any new tap clears a stale back/forward flag.
    const onClick = () => {
      backForward.current = false;
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useLayoutEffect(() => {
    const reset = shouldResetScroll({
      prevPath: prevPath.current,
      nextPath: pathname,
      hash: window.location.hash,
      wasBackForward: backForward.current,
    });
    if (prevPath.current !== pathname) backForward.current = false;
    prevPath.current = pathname;
    if (!reset) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // Late layout on iOS (images, toolbar resize) can nudge it once more.
    const id = window.requestAnimationFrame(() => {
      if (window.scrollY !== 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
