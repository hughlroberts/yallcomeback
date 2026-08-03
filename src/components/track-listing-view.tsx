"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget public listing view for host Insights.
 * Dedupes once per property per browser tab session.
 */
export function TrackListingView({ propertyId }: { propertyId: string }) {
  useEffect(() => {
    if (!propertyId || typeof window === "undefined") return;
    const key = `ycb:viewed:${propertyId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* private mode — still count once per mount */
    }

    void fetch("/api/listing-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId }),
      keepalive: true,
    }).catch(() => {
      /* ignore network errors */
    });
  }, [propertyId]);

  return null;
}
