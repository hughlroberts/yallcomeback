import { prisma } from "@/lib/db";
import { hashAuthToken } from "@/lib/auth-tokens";

export type ConfirmEmailResult = "ok" | "invalid" | "already" | "missing";

export async function confirmEmailWithToken(
  raw: string,
): Promise<ConfirmEmailResult> {
  const token = raw.trim();
  if (!token) return "missing";
  const tokenHash = hashAuthToken(token);
  const row = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, emailVerifiedAt: true } },
    },
  });
  if (!row || row.kind !== "EMAIL_VERIFY") return "invalid";
  if (row.user.emailVerifiedAt) {
    if (!row.usedAt) {
      await prisma.authToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
    }
    return "already";
  }
  if (row.usedAt || row.expiresAt.getTime() <= Date.now()) return "invalid";

  const stamped = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (stamped.count !== 1) return "invalid";
  await prisma.user.update({
    where: { id: row.userId },
    data: { emailVerifiedAt: new Date() },
  });
  return "ok";
}
