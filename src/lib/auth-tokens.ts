import { createHash, randomBytes } from "crypto";
import type { AuthTokenKind } from "@prisma/client";
import { prisma } from "@/lib/db";

export const EMAIL_VERIFY_TTL_MS = 48 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function hashAuthToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newRawAuthToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function issueAuthToken(opts: {
  userId: string;
  kind: AuthTokenKind;
  ttlMs: number;
}): Promise<string> {
  const raw = newRawAuthToken();
  const tokenHash = hashAuthToken(raw);
  const expiresAt = new Date(Date.now() + opts.ttlMs);
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId: opts.userId, kind: opts.kind, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId: opts.userId,
        kind: opts.kind,
        tokenHash,
        expiresAt,
      },
    }),
  ]);
  return raw;
}

export async function peekAuthToken(
  raw: string,
  kind: AuthTokenKind,
): Promise<{ userId: string; email: string; role: string } | null> {
  const tokenHash = hashAuthToken(raw.trim());
  if (!raw.trim()) return null;
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  if (!row || row.kind !== kind) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  return { userId: row.user.id, email: row.user.email, role: row.user.role };
}

export async function consumeAuthToken(
  raw: string,
  kind: AuthTokenKind,
): Promise<{ userId: string; email: string; role: string } | null> {
  const tokenHash = hashAuthToken(raw.trim());
  if (!raw.trim()) return null;
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  if (!row || row.kind !== kind) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  const stamped = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (stamped.count !== 1) return null;
  return { userId: row.user.id, email: row.user.email, role: row.user.role };
}
