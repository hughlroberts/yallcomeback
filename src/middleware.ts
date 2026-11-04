import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import {
  authConfig,
  isOpsAdminRequest,
  isOpsPath,
  OPS_NOT_FOUND_HEADER,
  platformGate,
} from "./auth.config";
import {
  resolveHostSlugForHostname,
  isPlatformPath,
} from "./lib/custom-domains";
import { TENANT_SLUG_HEADER } from "./lib/tenant-constants";
import { applyVisitorCookies } from "./lib/analytics-visitor";
import {
  adminBrandParamRedirect,
  adminHostIdParamRedirect,
  adminLegacyBrandParamRewrite,
} from "./lib/admin-brand-path";
import {
  ADMIN_BRAND_COOKIE,
  ADMIN_BRAND_SLUG_COOKIE,
} from "./lib/admin-brand-cookie";
import { bareDomainRedirect, httpsRedirect } from "./lib/canonical-host";

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
  requestHeaders.delete(OPS_NOT_FOUND_HEADER);
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
    return applyVisitorCookies(
      req,
      NextResponse.rewrite(opts.rewriteUrl, {
        request: { headers: requestHeaders },
      }),
    );
  }
  return applyVisitorCookies(
    req,
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
  );
}

function passthrough(
  req: NextRequest,
  opts?: { opsNotFound?: boolean },
): NextResponse {
  const requestHeaders = cleanRequestHeaders(req);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  if (opts?.opsNotFound) requestHeaders.set(OPS_NOT_FOUND_HEADER, "1");
  return applyVisitorCookies(
    req,
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
  );
}

/**
 * Prefer the public hostname (proxies often set x-forwarded-host).
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
  // Deploy health check: no host lookup, no redirects (any Host header)
  if (req.nextUrl.pathname === "/api/health") return NextResponse.next();

  // R1/T2: plain http on the product domain → https://www, same path (308).
  // /api/* is exempt inside httpsRedirect (webhooks and cron don't follow).
  const toHttps = httpsRedirect({
    hostname: requestHostname(req),
    forwardedProto: req.headers.get("x-forwarded-proto"),
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
  });
  if (toHttps) return NextResponse.redirect(toHttps, 308);

  // Bare product domain → https://www, same path (301; 308 keeps POST bodies)
  const canonical = bareDomainRedirect({
    hostname: requestHostname(req),
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
  });
  if (canonical) {
    const safe = req.method === "GET" || req.method === "HEAD";
    return NextResponse.redirect(canonical, safe ? 301 : 308);
  }

  // Backstop: Auth.js skips its own sign-in redirect when this function
  // exists and authorized() returns a boolean. Returning a Response from
  // platformGate covers both that path and the authorized() callback.
  const gate = platformGate({
    isLoggedIn: Boolean(req.auth?.user),
    role: req.auth?.user?.role,
    nextUrl: req.nextUrl,
  });
  if (gate !== true) return gate;

  // The old ?brand=1 marker: show the picked brand's slug instead (or drop
  // it when no brand is picked), so every admin URL names its brand.
  const legacyBrand = adminLegacyBrandParamRewrite({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    role: req.auth?.user?.role,
    slugCookie: req.cookies.get(ADMIN_BRAND_SLUG_COOKIE)?.value,
  });
  // GET/HEAD only: a server action POSTs to the page URL and must not be
  // redirected.
  if (legacyBrand && (req.method === "GET" || req.method === "HEAD")) {
    return NextResponse.redirect(new URL(legacyBrand, req.nextUrl));
  }

  // Bookmarkable brand URLs: /admin/...?brand=<slug> switches the picked
  // brand first (only when it differs).
  const brandSwitch = adminBrandParamRedirect({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    role: req.auth?.user?.role,
    slugCookie: req.cookies.get(ADMIN_BRAND_SLUG_COOKIE)?.value,
  });
  if (brandSwitch) {
    return NextResponse.redirect(new URL(brandSwitch, req.nextUrl));
  }

  // T42: /admin/...?hostId=<id> picks that brand first, so the top bar and
  // the page always show the same brand. GET/HEAD only (server actions POST).
  const hostIdSwitch = adminHostIdParamRedirect({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    role: req.auth?.user?.role,
    brandCookie: req.cookies.get(ADMIN_BRAND_COOKIE)?.value,
  });
  if (hostIdSwitch && (req.method === "GET" || req.method === "HEAD")) {
    const res = NextResponse.redirect(new URL(hostIdSwitch, req.nextUrl));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  // Platform admins: keep /ops out of every index.
  if (isOpsAdminRequest(req.nextUrl.pathname, req.auth?.user?.role)) {
    const res = passthrough(req);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }
  // Everyone else: tag the request; next.config rewrites it to an unknown
  // path so the response is Next's stock 404, header-for-header like /zzz.
  if (isOpsPath(req.nextUrl.pathname)) {
    return passthrough(req, { opsNotFound: true });
  }

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
    // /logout is excluded: Auth.js middleware re-issues the session cookie
    // on every request, which would undo the logout on that response.
    "/((?!_next/static|_next/image|logout$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
