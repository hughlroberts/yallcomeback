import { prisma } from "@/lib/db";
import { canonicalSiteOrigin } from "@/lib/features";
import { dispatchPlatformEmail } from "@/lib/messaging";
import { canSendEmailTo } from "@/lib/notification-prefs";
import { listingCanonicalPath } from "@/lib/site-url";

/**
 * "We sent your question to the host" receipt for the guest.
 *
 * Anyone can type any address into the form, so this email must not become a
 * way to mail strangers:
 * - only for a new question (repeats / dedupe hits never send one);
 * - at most GUEST_CONFIRM_LIMITS per address, counted in the DB so the cap
 *   survives restarts, across every host and listing;
 * - fixed wording: nothing the sender typed (name, subject, message, links)
 *   is copied into it, only the host and listing names hosts set themselves;
 * - respects the address's email opt-out.
 */
export const GUEST_CONFIRM_LIMITS = {
  perHour: 1,
  perDay: 3,
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type GuestConfirmOutcome =
  "sent" | "capped" | "opted_out" | "not_sent" | "skipped";

/** Pure: subject and body of the receipt. No sender-supplied text. */
export function guestConfirmEmail(opts: {
  hostName: string;
  propertyTitle: string | null;
  listingUrl: string | null;
}): { subject: string; text: string } {
  const host = opts.hostName.trim() || "the host";
  const about = opts.propertyTitle?.trim();
  const lines = [
    "Hi,",
    "",
    about
      ? `We sent your question about ${about} to ${host}.`
      : `We sent your message to ${host}.`,
    "You'll get an email at this address when they reply.",
  ];
  if (opts.listingUrl) lines.push("", `Listing: ${opts.listingUrl}`);
  lines.push(
    "",
    "If you didn't send this, you can ignore this email. We send at most a few of these to any address.",
  );
  return {
    subject: `We sent your question to ${host}`,
    text: lines.join("\n"),
  };
}

export async function sendGuestInquiryConfirmation(opts: {
  conversationId: string;
  guestEmail: string;
  hostName: string;
  propertyTitle: string | null;
  propertySlug: string | null;
  now?: Date;
}): Promise<GuestConfirmOutcome> {
  const now = opts.now ?? new Date();
  const email = opts.guestEmail.trim().toLowerCase();
  if (!email.includes("@")) return "skipped";

  const recent = (since: Date) =>
    prisma.conversation.count({
      where: {
        guestEmail: { equals: email, mode: "insensitive" },
        guestConfirmSentAt: { gte: since },
      },
    });
  const [hour, day] = await Promise.all([
    recent(new Date(now.getTime() - HOUR)),
    recent(new Date(now.getTime() - DAY)),
  ]);
  if (
    hour >= GUEST_CONFIRM_LIMITS.perHour ||
    day >= GUEST_CONFIRM_LIMITS.perDay
  ) {
    return "capped";
  }
  if (!(await canSendEmailTo(email))) return "opted_out";

  // Claim the slot before sending so two parallel submits can't both send.
  const claimed = await prisma.conversation.updateMany({
    where: { id: opts.conversationId, guestConfirmSentAt: null },
    data: { guestConfirmSentAt: now },
  });
  if (claimed.count === 0) return "skipped";

  const listingUrl = opts.propertySlug
    ? `${canonicalSiteOrigin()}${listingCanonicalPath(opts.propertySlug)}`
    : null;
  const { subject, text } = guestConfirmEmail({
    hostName: opts.hostName,
    propertyTitle: opts.propertyTitle,
    listingUrl,
  });
  const result = await dispatchPlatformEmail({ to: email, subject, text });
  if (result.status === "sent") return "sent";
  console.warn("[inquiry:guest-confirm]", result.status, result.detail);
  return "not_sent";
}
