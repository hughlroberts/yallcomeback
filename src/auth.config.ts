import type { NextAuthConfig } from "next-auth";

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
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const path = nextUrl.pathname;

      if (path.startsWith("/admin")) {
        // Login required here. HOST vs GUEST is enforced in the admin layout
        // from the database so a guest who just chose Start hosting is not
        // bounced by a stale JWT.
        if (!isLoggedIn) return false;
        return true;
      }

      if (path.startsWith("/ops")) {
        if (!isLoggedIn) return false;
        if (role !== "ADMIN") {
          return Response.redirect(new URL("/admin?error=admin_only", nextUrl));
        }
        return true;
      }

      if (path.startsWith("/account") && !isLoggedIn) {
        return false;
      }

      if (path.startsWith("/messages") && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
