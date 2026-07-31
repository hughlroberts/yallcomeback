import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { authConfig } from "@/auth.config";
import type { Role } from "@prisma/client";

/** How often to re-read role/hostId from the database (ms). */
const ROLE_REFRESH_MS = 60_000;

declare module "next-auth" {
  interface User {
    role: Role;
    hostId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      hostId?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    hostId?: string | null;
    /** Last time role/hostId were loaded from the DB */
    roleCheckedAt?: number;
  }
}

async function refreshRoleFromDb(token: {
  id?: string;
  role?: Role;
  hostId?: string | null;
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
      name: true,
      email: true,
    },
  });

  if (!dbUser) {
    // Account removed — demote so gates fail closed
    token.role = "GUEST";
    token.hostId = null;
    token.roleCheckedAt = now;
    return token;
  }

  token.role = dbUser.role;
  token.hostId = dbUser.hostId;
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

/** Host owner OR platform admin. Returns hostId scope (null = all hosts for platform admin). */
export async function requireHostAdmin(hostId?: string) {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.role === "ADMIN") {
    return { session, hostId: hostId ?? null, isPlatform: true as const };
  }

  if (session.user.role === "HOST" && session.user.hostId) {
    if (hostId && hostId !== session.user.hostId) return null;
    return {
      session,
      hostId: session.user.hostId,
      isPlatform: false as const,
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
