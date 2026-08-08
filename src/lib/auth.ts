import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { authConfig } from "@/auth.config";
import type { HostAccessLevel, Role } from "@prisma/client";

/** How often to re-read role/hostId from the database (ms). */
const ROLE_REFRESH_MS = 60_000;

declare module "next-auth" {
  interface User {
    role: Role;
    hostId?: string | null;
    hostAccess?: HostAccessLevel | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      hostId?: string | null;
      hostAccess?: HostAccessLevel | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    hostId?: string | null;
    hostAccess?: HostAccessLevel | null;
    /** Last time role/hostId were loaded from the DB */
    roleCheckedAt?: number;
  }
}

async function refreshRoleFromDb(token: {
  id?: string;
  role?: Role;
  hostId?: string | null;
  hostAccess?: HostAccessLevel | null;
  roleCheckedAt?: number;
  name?: string | null;
  email?: string | null;
}) {
  const userId = token.id;
  if (!userId) return token;

  const now = Date.now();
  const last = token.roleCheckedAt ?? 0;
  if (now - last < ROLE_REFRESH_MS) return token;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      hostId: true,
      hostAccess: true,
      name: true,
      email: true,
    },
  });

  if (!dbUser) {
    // Account removed — demote so gates fail closed
    token.role = "GUEST";
    token.hostId = null;
    token.hostAccess = null;
    token.roleCheckedAt = now;
    return token;
  }

  token.role = dbUser.role;
  token.hostId = dbUser.hostId;
  token.hostAccess =
    dbUser.role === "HOST" ? dbUser.hostAccess ?? "OWNER" : null;
  token.name = dbUser.name;
  token.email = dbUser.email;
  token.roleCheckedAt = now;
  return token;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hostId: user.hostId,
          hostAccess:
            user.role === "HOST" ? user.hostAccess ?? "OWNER" : null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Fresh login — stamp claims from authorize()
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.hostId = user.hostId ?? null;
        token.hostAccess = user.hostAccess ?? null;
        token.roleCheckedAt = Date.now();
        return token;
      }

      // Ongoing session — re-read role/hostId from DB on a short interval
      // so ops role changes apply without forcing re-login.
      return refreshRoleFromDb(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? "";
        session.user.role = (token.role as Role) ?? "GUEST";
        session.user.hostId = (token.hostId as string | null) ?? null;
        session.user.hostAccess =
          (token.hostAccess as HostAccessLevel | null) ?? null;
        if (token.name !== undefined) {
          session.user.name = token.name as string | null;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
});

/** Platform operator */
export async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

/**
 * Host owner OR platform admin.
 * Platform admins may be brand-scoped via the ycb_admin_brand cookie
 * (or an explicit hostId argument). When scoped, hostId is set so admin
 * lists only show that brand — not every host’s listings mixed together.
 */
export async function requireHostAdmin(hostId?: string) {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role === "ADMIN") {
    let resolved = hostId ?? null;
    if (!resolved) {
      const { getAdminBrandHostId } = await import("@/lib/admin-brand-context");
      resolved = await getAdminBrandHostId();
    }
    return {
      session,
      hostId: resolved,
      isPlatform: true as const,
      hostAccess: null as HostAccessLevel | null,
    };
  }

  if (session.user.role === "HOST" && session.user.hostId) {
    if (hostId && hostId !== session.user.hostId) return null;
    return {
      session,
      hostId: session.user.hostId,
      isPlatform: false as const,
      hostAccess: (session.user.hostAccess ?? "OWNER") as HostAccessLevel,
    };
  }

  return null;
}

/** @deprecated use requireHostAdmin or requirePlatformAdmin */
export async function requireAdmin() {
  const access = await requireHostAdmin();
  if (!access) return null;
  return access.session;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) return null;
  return session;
}
