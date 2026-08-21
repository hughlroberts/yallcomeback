import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import {
  resolveHostSlugForHostname,
  isPlatformPath,
} from "./lib/custom-domains";
import { TENANT_SLUG_HEADER } from "./lib/tenant-constants";

const { auth } = NextAuth(authConfig);

/**
 * Guest paths on a host custom domain → host-branded /h/[slug] routes.
 * Admin / login / ops stay on the platform (isPlatformPath).
 */
function rewriteHostGuestPath(
  req: NextRequest,
  hostSlug: string,
): NextResponse | null {
  const { pathname } = req.nextUrl;

  if (isPlatformPath(pathname)) {
    return null;
  }

  // Already under this host microsite (custom domain hitting /h/… directly)
  if (
    pathname === `/h/${hostSlug}` ||
    pathname.startsWith(`/h/${hostSlug}/`)
  ) {
    return withTenant(req, hostSlug, { mode: "custom" });
  }

  // Don't nest foreign host microsites
  if (pathname.startsWith("/h/")) {
    return null;
  }

  let target: string | null = null;

  if (pathname === "/" || pathname === "") {
    target = `/h/${hostSlug}`;
  } else if (pathname === "/about" || pathname.startsWith("/about/")) {
    target = `/h/${hostSlug}/about`;
  } else if (pathname === "/services" || pathname.startsWith("/services/")) {
    target = `/h/${hostSlug}/services`;
  } else if (pathname === "/contact" || pathname.startsWith("/contact/")) {
    target = `/h/${hostSlug}/contact`;
  } else if (
    pathname === "/stays" ||
    pathname === "/marketplace" ||
    pathname === "/properties"
  ) {
    target = `/h/${hostSlug}/stays`;
  } else if (pathname.startsWith("/properties/")) {
    // Host-native listing path → microsite property (then booking UI)
    const slug = pathname.slice("/properties/".length).split("/")[0];
    if (slug) target = `/h/${hostSlug}/properties/${slug}`;
  } else {
    // Single-segment custom path (e.g. /boat-rentals) → host page slug route
    // Reserved fixed pages above take priority; dynamic page 404s if not configured.
    const m = pathname.match(/^\/([a-z0-9][a-z0-9-]{0,79})\/?$/i);
    const seg = m?.[1]?.toLowerCase();
    const reserved = new Set([
      "stays",
      "about",
      "contact",
      "services",
      "properties",
      "marketplace",
      "book",
      "login",
      "register",
      "account",
      "messages",
      "admin",
      "ops",
      "api",
      "help",
      "saved",
      "calendar",
      "locations",
      "favicon.ico",
      "robots.txt",
      "sitemap.xml",
    ]);
    if (seg && !reserved.has(seg)) {
      target = `/h/${hostSlug}/${seg}`;
    }
  }
  // /marketplace/properties/* stays as-is with tenant chrome (booking UI).
  // Do not rewrite it back to /h/.../properties or we loop with the host property redirect.

  if (!target) {
    // Other guest paths still get tenant chrome (header/footer) via header
    return withTenant(req, hostSlug, { mode: "custom" });
  }

  const url = req.nextUrl.clone();
  url.pathname = target;
  return withTenant(req, hostSlug, { rewriteUrl: url, mode: "custom" });
}

/** Drop client-supplied tenant headers so guests cannot spoof host chrome. */
function cleanRequestHeaders(req: NextRequest): Headers {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.delete(TENANT_SLUG_HEADER);
  requestHeaders.delete("x-tenant-mode");
  return requestHeaders;
}

function withTenant(
  req: NextRequest,
  hostSlug: string,
  opts?: { rewriteUrl?: URL; mode?: "custom" | "path" },
): NextResponse {
  const requestHeaders = cleanRequestHeaders(req);
  requestHeaders.set(TENANT_SLUG_HEADER, hostSlug);
  // custom = root paths on host domain; path = /h/slug preview on platform
  requestHeaders.set("x-tenant-mode", opts?.mode ?? "custom");
  // Original browser path (before rewrite) — used to hide header on home only
  requestHeaders.set("x-pathname", req.nextUrl.pathname);

  if (opts?.rewriteUrl) {
    return NextResponse.rewrite(opts.rewriteUrl, {
      request: { headers: requestHeaders },
    });
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function passthrough(req: NextRequest): NextResponse {
  const requestHeaders = cleanRequestHeaders(req);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

/**
 * Prefer the public hostname (Railway / reverse proxies set x-forwarded-host).
 */
function requestHostname(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const raw = forwarded || req.headers.get("host");
  return raw?.split(":")[0]?.toLowerCase() || null;
}

/**
 * 1) Custom domain → host brand rewrite + tenant header
 * 2) Auth gates for /admin and /account (Auth.js)
 * 3) Strip spoofed x-tenant-* on every request
 */
export default auth(async (req) => {
  const hostname = requestHostname(req);
  // Env HOST_DOMAIN_MAP + Host.customDomain via /api/domain-map
  const hostSlug = await resolveHostSlugForHostname(hostname);

  if (hostSlug) {
    const rewritten = rewriteHostGuestPath(req, hostSlug);
    if (rewritten) return rewritten;
  }

  // Platform preview of /h/[slug]… branded chrome with /h/slug link prefix
  const path = req.nextUrl.pathname;
  const hMatch = path.match(/^\/h\/([a-z0-9-]+)(?:\/|$)/i);
  if (hMatch?.[1]) {
    return withTenant(req, hMatch[1].toLowerCase(), { mode: "path" });
  }

  return passthrough(req);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
