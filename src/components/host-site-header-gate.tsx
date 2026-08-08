"use client";

import { usePathname } from "next/navigation";

type Props = {
  /** Empty on custom domain; `/h/slug` on platform preview */
  basePath: string;
  children: React.ReactNode;
};

/**
 * Show sticky host header on all guest pages except the landing home.
 * Must be client-side: root layout does not re-render on client navigations,
 * so a server-only pathname check (from middleware headers) would leave the
 * header stuck hidden after leaving home.
 */
export function HostSiteHeaderGate({ basePath, children }: Props) {
  const raw = usePathname() || "/";
  const pathname = raw.replace(/\/$/, "") || "/";
  const home = (basePath || "").replace(/\/$/, "") || "";

  const isHostHome =
    home === ""
      ? pathname === "/"
      : pathname === home || pathname === `${home}/`;

  if (isHostHome) return null;
  return <>{children}</>;
}
