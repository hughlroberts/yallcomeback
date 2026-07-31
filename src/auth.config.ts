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
        token.role = (user as { role?: string }).role ?? "GUEST";
        token.hostId = (user as { hostId?: string | null }).hostId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as "ADMIN" | "HOST" | "GUEST") ?? "GUEST";
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
        if (!isLoggedIn) return false;
        if (role !== "ADMIN" && role !== "HOST") {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (path.startsWith("/account") && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
