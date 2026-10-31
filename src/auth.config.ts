import type { NextAuthConfig } from "next-auth";

/** /ops is internal: platform admins only; everyone else sees a plain 404. */
export function isOpsPath(pathname: string): boolean {
  return pathname === "/ops" || pathname.startsWith("/ops/");
}

/**
 * Internal request header: middleware sets it on non-admin /ops requests and
 * next.config beforeFiles rewrites those to an unknown path, so Next serves
 * its normal 404 with exactly the headers of any unknown URL (a config
 * rewrite, unlike NextResponse.rewrite, adds no x-middleware-rewrite).
 * Client-supplied copies are stripped in middleware.
 */
export const OPS_NOT_FOUND_HEADER = "x-ycb-ops-404";

/**
 * Middleware may only add ops-specific response headers (noindex) for a
 * platform-admin token; everyone else must get exactly what an unknown URL gets.
 */
export function isOpsAdminRequest(
  pathname: string,
  role?: string | null,
): boolean {
  return isOpsPath(pathname) && role === "ADMIN";
}

/**
 * Anonymous visits must return a redirect Response.
 * Returning false does nothing when middleware.ts also supplies a
 * custom middleware function: Auth.js then runs that function and
 * skips the sign-in redirect.
 */
export function signInRedirect(nextUrl: URL): Response {
  const dest = new URL("/login", nextUrl.origin);
  dest.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
  return Response.redirect(dest);
}

export function platformGate(input: {
  isLoggedIn: boolean;
  /** Not used for gating today (/ops checks the DB role in its pages). */
  role?: string | null;
  nextUrl: URL;
}): true | Response {
  const { isLoggedIn, nextUrl } = input;
  const path = nextUrl.pathname;

  if (path.startsWith("/admin")) {
    // Login required here. HOST vs GUEST is enforced in the admin layout
    // from the database so a guest who just chose Start hosting is not
    // bounced by a stale JWT.
    if (!isLoggedIn) return signInRedirect(nextUrl);
    return true;
  }

  if (isOpsPath(path)) {
    // Internal: signed out, guest, host and host admin all get a plain 404
    // (no /login redirect, no "admin only" notice) so /ops stays unknown.
    // No NextResponse.rewrite: it leaks x-middleware-rewrite, which an
    // unknown URL does not have. Middleware tags the request
    // (OPS_NOT_FOUND_HEADER) and a next.config rewrite serves the stock 404.
    // Backstop: the ops layout, pages and route handlers also call
    // requirePlatformAdminOr404() (DB role) → notFound().
    return true;
  }

  if (path.startsWith("/account") && !isLoggedIn) {
    return signInRedirect(nextUrl);
  }

  if (path.startsWith("/messages") && !isLoggedIn) {
    return signInRedirect(nextUrl);
  }

  return true;
}

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        const role = (user as { role?: "ADMIN" | "HOST" | "GUEST" }).role;
        token.role = role ?? "GUEST";
        token.hostId = (user as { hostId?: string | null }).hostId ?? null;
        token.roleCheckedAt = Date.now();
      }
      // No DB access here (edge middleware). Full refresh is in lib/auth.ts.
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role =
          (token.role as "ADMIN" | "HOST" | "GUEST" | undefined) ?? "GUEST";
        (session.user as { hostId?: string | null }).hostId =
          (token.hostId as string | null) ?? null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      return platformGate({
        isLoggedIn: Boolean(auth?.user),
        role: auth?.user?.role,
        nextUrl,
      });
    },
  },
} satisfies NextAuthConfig;
