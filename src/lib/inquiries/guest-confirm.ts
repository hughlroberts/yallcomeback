import { prisma } from "@/lib/db";
import { canonicalSiteOrigin } from "@/lib/features";
import { dispatchPlatformEmail } from "@/lib/messaging";
import { guestThreadUrl } from "@/lib/guest-thread-access";
import { maskEmail } from "@/lib/host-recipients";
import { canSendEmailTo } from "@/lib/notification-prefs";
import { listingCanonicalPath } from "@/lib/site-url";
import { formatDateUS } from "@/lib/utils";

/**
 * "We sent your question to the host" receipt for the guest.
 *
 * Anyone can type any address into the form, so this email must not become a
 * way to mail strangers:
 * - only for a new question (repeats / dedupe hits never send one);
 * - at most GUEST_CONFIRM_LIMITS per address, counted in the DB so the cap
 *   survives restarts, across every host and listing;
 * - fixed wording around the details: the listing and host names (set by the
 *   host), trip dates and guest count (validated values), and the inquiry
 *   reference. The guest's message is copied as a quote with every link and
 *   web address removed and a length cap, so the receipt cannot carry a
 *   sender's link or a long text to a stranger. The sender's name and
 *   subject are never copied;
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

/** Longest message copy in the receipt (characters, before the quote marks). */
export const GUEST_CONFIRM_MESSAGE_MAX = 1000;

export type GuestConfirmTrip = {
  checkIn?: string | null;
  checkOut?: string | null;
  guests?: number | null;
};

const LINKISH =
  /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?/gi;

/** Pure: the guest's message for the receipt, with links and addresses removed. */
export function receiptMessageCopy(body: string | null | undefined): string | null {
  const clean = (body ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(LINKISH, "[link removed]")
    .trim();
  if (!clean) return null;
  if (clean.length <= GUEST_CONFIRM_MESSAGE_MAX) return clean;
  return `${clean.slice(0, GUEST_CONFIRM_MESSAGE_MAX).trimEnd()}…`;
}

/** Pure: subject and body of the receipt. */
export function guestConfirmEmail(opts: {
  hostName: string;
  propertyTitle: string | null;
  listingUrl: string | null;
  /** The guest's conversation (signed no-login link, or sign-in thread page). */
  conversationUrl?: string | null;
  reference?: string | null;
  trip?: GuestConfirmTrip | null;
  message?: string | null;
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
    "",
  ];
  if (opts.conversationUrl) {
    lines.push(`View your conversation: ${opts.conversationUrl}`, "");
  }
  if (about) lines.push(`Listing: ${about}`);
  if (opts.listingUrl) lines.push(`Listing page: ${opts.listingUrl}`);
  const ci = formatDateUS(opts.trip?.checkIn);
  const co = formatDateUS(opts.trip?.checkOut);
  if (ci && co) lines.push(`Dates: ${ci} to ${co}`);
  else if (ci) lines.push(`Check-in: ${ci}`);
  const g = opts.trip?.guests;
  if (typeof g === "number" && Number.isInteger(g) && g > 0) {
    lines.push(`Guests: ${g}`);
  }
  if (opts.reference) lines.push(`Inquiry reference: ${opts.reference}`);
  const copy = receiptMessageCopy(opts.message);
  if (copy) {
    lines.push(
      "",
      "Your message (links removed):",
      ...copy.split("\n").map((l) => `> ${l}`),
    );
  }
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
  /** Signed-in guest who sent it (their link opens the sign-in thread page). */
  guestUserId?: string | null;
  trip?: GuestConfirmTrip | null;
  /** The question as saved for the host (copied with links removed). */
  message?: string | null;
  now?: Date;
}): Promise<GuestConfirmOutcome> {
  const now = opts.now ?? new Date();
  const email = opts.guestEmail.trim().toLowerCase();
  // Every outcome is logged (masked address) so a missing receipt is traceable.
  const done = (outcome: GuestConfirmOutcome, detail?: string) => {
    const line = {
      conversationId: opts.conversationId,
      to: maskEmail(email),
      outcome,
      ...(detail ? { detail } : {}),
    };
    if (outcome === "sent") console.info("[inquiry:guest-confirm]", line);
    else console.warn("[inquiry:guest-confirm]", line);
    return outcome;
  };
  if (!email.includes("@")) return done("skipped", "invalid_address");

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
    return done("capped", `last_hour=${hour} last_day=${day}`);
  }
  if (!(await canSendEmailTo(email))) return done("opted_out");

  // Claim the slot before sending so two parallel submits can't both send.
  const claimed = await prisma.conversation.updateMany({
    where: { id: opts.conversationId, guestConfirmSentAt: null },
    data: { guestConfirmSentAt: now },
  });
  if (claimed.count === 0) return done("skipped", "already_sent");

  const listingUrl = opts.propertySlug
    ? `${canonicalSiteOrigin()}${listingCanonicalPath(opts.propertySlug)}`
    : null;
  const { subject, text } = guestConfirmEmail({
    hostName: opts.hostName,
    propertyTitle: opts.propertyTitle,
    listingUrl,
    conversationUrl: guestThreadUrl({
      id: opts.conversationId,
      guestEmail: email,
      guestUserId: opts.guestUserId ?? null,
    }),
    reference: opts.conversationId,
    trip: opts.trip,
    message: opts.message,
  });
  const result = await dispatchPlatformEmail({ to: email, subject, text });
  if (result.status === "sent") return done("sent");
  // Not delivered: release the claim so it doesn't use up this address's cap.
  await prisma.conversation
    .updateMany({
      where: { id: opts.conversationId, guestConfirmSentAt: now },
      data: { guestConfirmSentAt: null },
    })
    .catch(() => {});
  return done("not_sent", `${result.status}:${result.detail ?? "?"}`);
}
