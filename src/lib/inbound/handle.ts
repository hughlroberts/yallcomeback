import { prisma } from "@/lib/db";
import { dedupeEmails } from "@/lib/host-recipients";
import {
  checkInquiryContent,
  INQUIRY_LIMITS,
  isNearDuplicate,
} from "@/lib/inquiries/filter";
import { rateLimitAllow } from "@/lib/rate-limit";
import {
  deliverGuestMessageToHosts,
  deliverHostMessageToGuest,
} from "@/lib/conversation-delivery";
import { parseReplyAddress, type ReplyRole } from "./reply-address";
import type { ReceivedEmail } from "./resend-receiving";
import { htmlToText, stripQuotedReply } from "./strip-reply";

/**
 * A reply that came in by email to reply+<token>@INBOUND_EMAIL_DOMAIN:
 * check who sent it, strip the quoted text, and add it to the thread in
 * /admin/messages (and the guest's /messages view), then tell the other side.
 */

export const INBOUND_LIMITS = {
  perSenderPerHour: 20,
  perThreadPerHour: 30,
  duplicateWindowMs: 24 * 60 * 60 * 1000,
} as const;

export type InboundOutcome =
  | { status: "added"; conversationId: string; messageId: string }
  | { status: "ignored"; reason: string };

const HOUR_MS = 60 * 60 * 1000;

/** "Hugh <h@x.com>" → "h@x.com" */
export function extractAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^<>\s]+@[^<>\s]+)>/);
  const a = (m ? m[1] : raw).trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/.test(a) ? a : null;
}

function recipientList(e: ReceivedEmail): string[] {
  const rf = Array.isArray(e.received_for)
    ? e.received_for
    : e.received_for
      ? [e.received_for]
      : [];
  return [...(e.to ?? []), ...(e.cc ?? []), ...rf]
    .flatMap((x) => String(x).split(","))
    .map(extractAddress)
    .filter((x): x is string => Boolean(x));
}

function header(e: ReceivedEmail, name: string): string {
  const h = e.headers ?? {};
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === name) return String(v ?? "").toLowerCase();
  }
  return "";
}

/** Out-of-office and bulk mail must never become thread messages (loops). */
export function isAutoReply(e: ReceivedEmail): boolean {
  const auto = header(e, "auto-submitted");
  if (auto && auto !== "no") return true;
  if (/\b(bulk|junk|list|auto_reply)\b/.test(header(e, "precedence")))
    return true;
  if (header(e, "x-autoreply") || header(e, "x-autorespond")) return true;
  if (header(e, "list-id") || header(e, "list-unsubscribe")) return true;
  const from = extractAddress(e.from) ?? "";
  return /^(mailer-daemon|postmaster|no-?reply)@/.test(from);
}

/** Resend's own SPF/DKIM/DMARC result (computed on receipt; not forgeable). */
export function failsAuthentication(e: ReceivedEmail): boolean {
  const a = e.authentication;
  if (!a) return false;
  if (a.dmarc === "fail") return true;
  return a.spf === "fail" && a.dkim === "fail";
}

type Thread = NonNullable<Awaited<ReturnType<typeof loadConversation>>>;

function loadConversation(id: string) {
  return prisma.conversation.findUnique({
    where: { id },
    include: {
      host: {
        select: {
          id: true,
          name: true,
          contactEmail: true,
          billingEmail: true,
          showEmailToGuests: true,
        },
      },
      guestUser: { select: { email: true } },
      booking: { select: { guestEmail: true } },
    },
  });
}

/** Booking emails carry the booking id; use (or start) its thread. */
async function bookingThread(bookingId: string): Promise<Thread | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      property: { select: { id: true, hostId: true, title: true } },
      conversations: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!booking) return null;
  let id = booking.conversations[0]?.id;
  if (!id) {
    const created = await prisma.conversation.create({
      data: {
        hostId: booking.property.hostId,
        propertyId: booking.property.id,
        bookingId: booking.id,
        guestUserId: booking.userId,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        guestPhone: booking.guestPhone,
        subject: `Booking · ${booking.property.title}`,
      },
      select: { id: true },
    });
    id = created.id;
  }
  return loadConversation(id);
}

async function senderAllowed(
  thread: Thread,
  role: ReplyRole,
  sender: string,
): Promise<boolean> {
  if (role === "GUEST") {
    return dedupeEmails([
      thread.guestEmail,
      thread.guestUser?.email,
      thread.booking?.guestEmail,
    ]).includes(sender);
  }
  // Hosts may reply even with email notifications off (opt-outs only stop
  // mail TO them).
  if (
    dedupeEmails([thread.host.contactEmail, thread.host.billingEmail]).includes(
      sender,
    )
  ) {
    return true;
  }
  const user = await prisma.user.findFirst({
    where: {
      email: { equals: sender, mode: "insensitive" },
      OR: [
        { hostId: thread.hostId, role: { in: ["HOST", "ADMIN"] } },
        { role: "ADMIN" },
      ],
    },
    select: { id: true },
  });
  return Boolean(user);
}

export function replyBody(e: ReceivedEmail): string {
  const raw = e.text?.trim() ? e.text : e.html ? htmlToText(e.html) : "";
  let body = stripQuotedReply(raw);
  if (body.length > INQUIRY_LIMITS.bodyMax) {
    body = `${body.slice(0, INQUIRY_LIMITS.bodyMax - 1)}…`;
  }
  return body;
}

export async function handleInboundEmail(
  e: ReceivedEmail,
  now = new Date(),
): Promise<InboundOutcome> {
  const ignored = (reason: string): InboundOutcome => {
    console.info("[inbound-email] ignored", { id: e.id, reason });
    return { status: "ignored", reason };
  };

  const target = recipientList(e)
    .map(parseReplyAddress)
    .find((x) => x !== null);
  if (!target) return ignored("no_thread_address");

  const sender = extractAddress(e.from);
  if (!sender) return ignored("bad_sender");
  if (failsAuthentication(e)) return ignored("auth_failed");
  if (isAutoReply(e)) return ignored("auto_reply");

  // Webhook retries: Resend may deliver the same email more than once.
  const seen = await prisma.message.findUnique({
    where: { inboundEmailId: e.id },
    select: { id: true },
  });
  if (seen) return ignored("already_added");

  const thread =
    target.kind === "c"
      ? await loadConversation(target.id)
      : await bookingThread(target.id);
  if (!thread) return ignored("thread_missing");

  if (!(await senderAllowed(thread, target.role, sender))) {
    return ignored("sender_not_on_thread");
  }

  if (
    !rateLimitAllow(
      `inbound-email:sender:${sender}`,
      INBOUND_LIMITS.perSenderPerHour,
      HOUR_MS,
    ) ||
    !rateLimitAllow(
      `inbound-email:thread:${thread.id}`,
      INBOUND_LIMITS.perThreadPerHour,
      HOUR_MS,
    )
  ) {
    return ignored("rate_limited");
  }

  const body = replyBody(e);
  if (!body) return ignored("empty");

  if (target.role === "GUEST") {
    // Same spam and link checks as the question form. "invalid" (e.g. a
    // short "Yes") is fine for a reply.
    const check = checkInquiryContent({
      guestName: thread.guestName,
      guestEmail: thread.guestEmail,
      body,
    });
    if (!check.ok && check.code !== "invalid") return ignored(check.code);
  }

  const last = await prisma.message.findFirst({
    where: {
      conversationId: thread.id,
      senderRole: target.role,
      createdAt: {
        gte: new Date(now.getTime() - INBOUND_LIMITS.duplicateWindowMs),
      },
    },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (last && isNearDuplicate(last.body, body)) return ignored("duplicate");

  let messageId: string;
  try {
    const m = await prisma.message.create({
      data: {
        conversationId: thread.id,
        senderRole: target.role,
        body,
        channel: "EMAIL",
        inboundEmailId: e.id,
        hostNotifyPending: target.role === "GUEST",
      },
      select: { id: true },
    });
    messageId = m.id;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return ignored("already_added");
    }
    throw err;
  }

  await prisma.conversation.update({
    where: { id: thread.id },
    data: { lastMessageAt: now, status: "OPEN" },
  });

  if (target.role === "GUEST") {
    await deliverGuestMessageToHosts(thread.hostId);
  } else {
    try {
      await deliverHostMessageToGuest(thread, messageId, body);
    } catch (err) {
      console.error("[inbound-email] guest delivery failed", err);
    }
  }
  console.info("[inbound-email] added", {
    id: e.id,
    conversationId: thread.id,
    role: target.role,
  });
  return { status: "added", conversationId: thread.id, messageId };
}
