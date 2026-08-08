import type { NextRequest } from "next/server";

/** Canonical public origin for deep links in agent API responses. */
export function publicOrigin(req: NextRequest): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Prefer production host over internal railway host when present
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (req.nextUrl.protocol === "https:" ? "https" : "http");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function absoluteUrl(origin: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
