"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Beacon a first-party page view. Visitor id + UTM live in httpOnly cookies
 * set by middleware; this only sends path and document referrer.
 */
export function TrackPageView() {
  return (
    <Suspense fallback={null}>
      <TrackPageViewInner />
    </Suspense>
  );
}

function TrackPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString()
      ? `?${searchParams.toString()}`
      : "";
    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: typeof document !== "undefined" ? document.referrer : "",
        search,
      }),
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [pathname, searchParams]);

  return null;
}
