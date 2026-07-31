import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import {
  hostSlugForHostname,
  isPlatformPath,
} from "./lib/custom-domains";
import { TENANT_SLUG_HEADER } from "./lib/tenant";

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

function withTenant(
  req: NextRequest,
  hostSlug: string,
  opts?: { rewriteUrl?: URL; mode?: "custom" | "path" },
): NextResponse {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(TENANT_SLUG_HEADER, hostSlug);
  // custom = root paths on host domain; path = /h/slug preview on platform
  requestHeaders.set("x-tenant-mode", opts?.mode ?? "custom");

  if (opts?.rewriteUrl) {
    return NextResponse.rewrite(opts.rewriteUrl, {
      request: { headers: requestHeaders },
    });
  }
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

/**
 * 1) Custom domain → host brand rewrite + tenant header
 * 2) Auth gates for /admin and /account (Auth.js)
 */
export default auth((req) => {
  const hostname = req.headers.get("host");
  const hostSlug = hostSlugForHostname(hostname);

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

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
