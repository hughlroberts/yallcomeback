import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

/**
 * Internal rewrite target that matches no route, so Next renders its normal
 * 404 page with a 404 status, byte-for-byte like any other unknown URL.
 * The browser URL stays the requested path.
 */
export const NOT_FOUND_REWRITE_PATH = "/__not-found";

/** /ops is internal: platform admins only; everyone else sees a plain 404. */
export function isOpsPath(pathname: string): boolean {
  return pathname === "/ops" || pathname.startsWith("/ops/");
}

export function notFoundRewrite(nextUrl: URL): Response {
  return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE_PATH, nextUrl.origin));
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
  role?: string | null;
  nextUrl: URL;
}): true | Response {
  const { isLoggedIn, role, nextUrl } = input;
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
    // Pages and route handlers re-check the DB role (requirePlatformAdminOr404).
    if (!isLoggedIn || role !== "ADMIN") return notFoundRewrite(nextUrl);
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
