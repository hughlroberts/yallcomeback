import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";
import { rateLimitAllow } from "@/lib/rate-limit";
import {
  checkInquiryContent,
  inquiryHash,
  isNearDuplicate,
} from "@/lib/inquiries/filter";
import {
  flushHostInquiryEmails,
  type NotifyOutcome,
} from "@/lib/inquiries/notify";

/**
 * One path for every pre-booking question, from the listing page form or
 * from an AI agent on /api/v1. Content filter, rate limits, and dedupe run
 * for both; honeypot / fill time / Turnstile are checked by the web caller.
 */

export const INQUIRY_RATE_LIMITS = {
  ipPer10Min: 5,
  ipPerDay: 20,
  emailPerHour: 3,
  emailPerDay: 10,
  listingPerHour: 20,
  hostPerHour: 60,
  hostPerDay: 300,
  /** Same text to one host from different senders in 24h → treated as a blast */
  sameTextSendersPerDay: 3,
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type InquirySource = "WEB" | "AGENT";

export type InquiryInput = {
  /** Listing by id (web form) or slug (agent API). */
  propertyId?: string | null;
  propertySlug?: string | null;
  /** Host-site contact without a listing (web only). */
  hostId?: string | null;
  bookingId?: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  subject?: string | null;
  body: string;
};

export type InquiryContext = {
  source: InquirySource;
  ip: string;
  sessionUserId?: string | null;
  agentName?: string | null;
  now?: Date;
};

export type InquiryResult =
  | {
      ok: true;
      conversationId: string;
      duplicate: boolean;
      hostNotification: NotifyOutcome;
    }
  | {
      ok: false;
      status: 400 | 404 | 422 | 429;
      code:
        | "invalid"
        | "links"
        | "spam"
        | "not_found"
        | "rate_limited"
        | "duplicate_blast";
      error: string;
    };

const TOO_MANY: InquiryResult = {
  ok: false,
  status: 429,
  code: "rate_limited",
  error: "Too many messages right now. Please try again later.",
};

export async function submitInquiry(
  input: InquiryInput,
  ctx: InquiryContext,
): Promise<InquiryResult> {
  const now = ctx.now ?? new Date();
  const guestName = input.guestName.trim();
  const guestEmail = input.guestEmail.trim().toLowerCase();
  const guestPhone = input.guestPhone?.trim() || null;
  const subjectIn = input.subject?.trim() || null;
  const body = input.body.trim();

  const content = checkInquiryContent({
    guestName,
    guestEmail,
    guestPhone,
    subject: subjectIn,
    body,
  });
  if (!content.ok) {
    return {
      ok: false,
      status: content.code === "invalid" ? 400 : 422,
      code: content.code,
      error: content.error,
    };
  }

  // Per-sender IP (in memory; Railway runs one web process).
  const ipKey = `inquiry:${ctx.ip}`;
  if (
    !rateLimitAllow(
      `${ipKey}:10m`,
      INQUIRY_RATE_LIMITS.ipPer10Min,
      10 * 60_000,
    ) ||
    !rateLimitAllow(`${ipKey}:day`, INQUIRY_RATE_LIMITS.ipPerDay, DAY)
  ) {
    return TOO_MANY;
  }

  // Resolve the listing or host.
  let hostId: string;
  let propertyId: string | null = null;
  let propertyTitle: string | null = null;
  let hostName: string;
  if (input.propertyId || input.propertySlug) {
    const property = await prisma.property.findFirst({
      where: input.propertyId
        ? { id: input.propertyId, published: true }
        : { slug: input.propertySlug!, ...marketplacePropertyWhere() },
      select: {
        id: true,
        title: true,
        hostId: true,
        host: { select: { name: true } },
      },
    });
    if (!property) {
      return {
        ok: false,
        status: 404,
        code: "not_found",
        error: "Listing not found.",
      };
    }
    hostId = property.hostId;
    propertyId = property.id;
    propertyTitle = property.title;
    hostName = property.host.name;
  } else if (input.hostId) {
    const host = await prisma.host.findUnique({
      where: { id: input.hostId },
      select: { id: true, name: true, active: true },
    });
    if (!host || !host.active) {
      return {
        ok: false,
        status: 404,
        code: "not_found",
        error: "Host not found.",
      };
    }
    hostId = host.id;
    hostName = host.name;
  } else {
    return {
      ok: false,
      status: 400,
      code: "invalid",
      error: "A listing or host is required.",
    };
  }

  // Dedupe: the same sender repeating (or nearly repeating) a question to
  // this host within 24h returns the existing thread instead of a new one.
  const since24h = new Date(now.getTime() - DAY);
  const recentFromSender = await prisma.conversation.findMany({
    where: {
      hostId,
      guestEmail: { equals: guestEmail, mode: "insensitive" },
      createdAt: { gte: since24h },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      messages: {
        where: { senderRole: "GUEST" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { body: true },
      },
    },
  });
  const dup = recentFromSender.find(
    (c) => c.messages[0] && isNearDuplicate(c.messages[0].body, body),
  );
  if (dup) {
    return {
      ok: true,
      conversationId: dup.id,
      duplicate: true,
      hostNotification: "none",
    };
  }

  const hash = inquiryHash(body);
  if (body.split(/\s+/).length >= 12) {
    const sameText = await prisma.conversation.count({
      where: { hostId, inquiryHash: hash, createdAt: { gte: since24h } },
    });
    if (sameText >= INQUIRY_RATE_LIMITS.sameTextSendersPerDay) {
      return {
        ok: false,
        status: 429,
        code: "duplicate_blast",
        error:
          "This host already received this exact message several times today.",
      };
    }
  }

  // Per-email, per-listing, per-host limits (stored in the DB, so they hold
  // across restarts).
  const since1h = new Date(now.getTime() - HOUR);
  const inquiryOnly = { inquirySource: { not: null } };
  const [emailHour, emailDay, listingHour, hostHour, hostDay] =
    await Promise.all([
      prisma.conversation.count({
        where: {
          ...inquiryOnly,
          guestEmail: { equals: guestEmail, mode: "insensitive" },
          createdAt: { gte: since1h },
        },
      }),
      prisma.conversation.count({
        where: {
          ...inquiryOnly,
          guestEmail: { equals: guestEmail, mode: "insensitive" },
          createdAt: { gte: since24h },
        },
      }),
      propertyId
        ? prisma.conversation.count({
            where: { ...inquiryOnly, propertyId, createdAt: { gte: since1h } },
          })
        : Promise.resolve(0),
      prisma.conversation.count({
        where: { ...inquiryOnly, hostId, createdAt: { gte: since1h } },
      }),
      prisma.conversation.count({
        where: { ...inquiryOnly, hostId, createdAt: { gte: since24h } },
      }),
    ]);
  if (
    emailHour >= INQUIRY_RATE_LIMITS.emailPerHour ||
    emailDay >= INQUIRY_RATE_LIMITS.emailPerDay ||
    listingHour >= INQUIRY_RATE_LIMITS.listingPerHour ||
    hostHour >= INQUIRY_RATE_LIMITS.hostPerHour ||
    hostDay >= INQUIRY_RATE_LIMITS.hostPerDay
  ) {
    return TOO_MANY;
  }

  // A booking link is kept only when this sender owns that booking.
  let bookingId: string | null = null;
  if (input.bookingId && ctx.source === "WEB") {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        propertyId: true,
        property: { select: { hostId: true } },
      },
    });
    const owns = Boolean(
      booking &&
      booking.property.hostId === hostId &&
      (!propertyId || booking.propertyId === propertyId) &&
      ((ctx.sessionUserId && booking.userId === ctx.sessionUserId) ||
        booking.guestEmail.toLowerCase() === guestEmail),
    );
    if (owns && booking) bookingId = booking.id;
  }

  const agentName = ctx.agentName?.trim().slice(0, 80) || null;
  const subject =
    subjectIn ||
    (propertyTitle
      ? `Question about ${propertyTitle}`
      : `Message for ${hostName}`);

  const conversation = await prisma.conversation.create({
    data: {
      hostId,
      propertyId,
      bookingId,
      guestUserId: ctx.sessionUserId || undefined,
      guestName,
      guestEmail,
      guestPhone,
      subject,
      lastMessageAt: now,
      inquirySource: ctx.source,
      inquiryAgent: ctx.source === "AGENT" ? agentName : null,
      inquiryHash: hash,
      messages: {
        create: {
          senderRole: "GUEST",
          senderUserId: ctx.sessionUserId || undefined,
          body,
          channel: "IN_APP",
          hostNotifyPending: true,
        },
      },
    },
    select: { id: true },
  });

  let hostNotification: NotifyOutcome = "queued";
  try {
    hostNotification = await flushHostInquiryEmails(hostId, now);
  } catch (e) {
    // The question is saved; the cron runner retries the email.
    console.error("[inquiry:notify]", e);
  }

  return {
    ok: true,
    conversationId: conversation.id,
    duplicate: false,
    hostNotification,
  };
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Pure: optional trip details become a first line the host can read. */
export function tripContextLine(b: {
  checkIn?: unknown;
  checkOut?: unknown;
  guests?: unknown;
}): string | null {
  const parts: string[] = [];
  const ci =
    typeof b.checkIn === "string" && YMD.test(b.checkIn) ? b.checkIn : null;
  const co =
    typeof b.checkOut === "string" && YMD.test(b.checkOut) ? b.checkOut : null;
  if (ci && co) parts.push(`Dates: ${ci} to ${co}`);
  else if (ci) parts.push(`Check-in: ${ci}`);
  const g = Number(b.guests);
  if (Number.isInteger(g) && g > 0 && g <= 50) {
    parts.push(`Guests: ${g}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
