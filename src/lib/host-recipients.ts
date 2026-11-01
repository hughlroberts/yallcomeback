/**
 * Who gets "host" emails for a brand (new booking / request, cancellations,
 * pre-booking questions). One list for every host email so they can't drift:
 *
 * - the brand's contact email (Admin → Brand → Contact email);
 * - the brand's billing email (the owner's account email for most brands);
 * - every user on the brand, owner and co-hosts alike (role HOST, or an
 *   ADMIN account that is scoped to this brand), with email notifications on.
 *
 * Anyone who turned email off (user setting or unsubscribe opt-out) is
 * skipped. Addresses are lowercased and deduped.
 */
import { prisma } from "@/lib/db";
import { canSendEmailTo } from "@/lib/notification-prefs";

export function dedupeEmails(list: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = (raw ?? "").trim().toLowerCase();
    if (!e || !e.includes("@") || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

export async function hostEmailRecipients(hostId: string): Promise<string[]> {
  const [host, users] = await Promise.all([
    prisma.host.findUnique({
      where: { id: hostId },
      select: { contactEmail: true, billingEmail: true },
    }),
    prisma.user.findMany({
      where: {
        hostId,
        role: { in: ["HOST", "ADMIN"] },
        emailNotifications: true,
      },
      select: { email: true },
    }),
  ]);
  const candidates = dedupeEmails([
    host?.contactEmail,
    host?.billingEmail,
    ...users.map((u) => u.email),
  ]);
  const out: string[] = [];
  for (const e of candidates) {
    if (await canSendEmailTo(e)) out.push(e);
  }
  if (out.length === 0) {
    console.warn("[host-email] no host recipients", { hostId });
  }
  return out;
}

/** "jo***@icloud.com" for logs (never log full guest/host addresses). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${(local ?? "").slice(0, 2)}***@${domain}`;
}
