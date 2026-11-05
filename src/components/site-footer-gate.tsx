"use client";

import { usePathname } from "next/navigation";

/**
 * Hide the marketing footer on immersive message thread views so the
 * composer/details stay pinned in the viewport (H6).
 */
export function SiteFooterGate({ children }: { children: React.ReactNode }) {
  const pathname = (usePathname() || "/").replace(/\/$/, "") || "/";
  const hide =
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/admin/messages" ||
    pathname.startsWith("/admin/messages/");
  if (hide) return null;
  return <>{children}</>;
}
