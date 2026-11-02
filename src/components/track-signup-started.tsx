"use client";

import { browserIsInternal } from "@/lib/analytics-internal";
import { useEffect } from "react";
import type { SignupStartedName } from "@/lib/analytics-visitor";

/** Beacon a one-per-visitor signup start. Completions are recorded server-side. */
export function TrackSignupStarted({
  name,
  path,
}: {
  name: SignupStartedName;
  path: string;
}) {
  useEffect(() => {
    if (browserIsInternal()) return;
    void fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path }),
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  }, [name, path]);

  return null;
}
