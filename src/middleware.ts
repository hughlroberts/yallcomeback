import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import {
  hostSlugForHostname,
  isPlatformPath,
} from "./lib/custom-domains";

const { auth } = NextAuth(authConfig);

/**
 * 1) Custom domain → host brand rewrite (e.g. cherokeelanding.net → /h/cherokee-landing)
 * 2) Auth gates for /admin and /account (Auth.js)
 */
export default auth((req) => {
  const hostname = req.headers.get("host");
  const hostSlug = hostSlugForHostname(hostname);
  const { pathname } = req.nextUrl;

  if (hostSlug && !isPlatformPath(pathname)) {
    // Homepage of the custom domain → host microsite entry
    if (pathname === "/" || pathname === "") {
      const url = req.nextUrl.clone();
      url.pathname = `/h/${hostSlug}`;
      return NextResponse.rewrite(url);
    }

    // Already on this host's /h paths — leave alone
    if (pathname === `/h/${hostSlug}` || pathname.startsWith(`/h/${hostSlug}/`)) {
      return NextResponse.next();
    }

    // Avoid double-prefixing foreign /h/other-host
    if (pathname.startsWith("/h/")) {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except static Next internals we never rewrite.
     * Auth still runs for /admin and /account via authorized() in auth.config.
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
