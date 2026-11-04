import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";
import {
  rateLimitHit,
  rateLimitPeek,
  type RateLimitName,
} from "@/lib/rate-limit";
import {
  checkInquiryContent,
  inquiryHash,
  isNearDuplicate,
} from "@/lib/inquiries/filter";
import {
  flushHostInquiryEmails,
  type NotifyOutcome,
} from "@/lib/inquiries/notify";
import {
  sendGuestInquiryConfirmation,
  type GuestConfirmOutcome,
} from "@/lib/inquiries/guest-confirm";

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
  /**
   * Duplicate re-sends (200, duplicate:true) do not use the per-IP limits
   * above; they have this looser per-IP cap so a loop cannot hammer the
   * database. Nothing is sent for a duplicate.
   */
  ipDuplicatesPer10Min: 30,
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
  /** Optional trip details for the guest's receipt (validated values only). */
  trip?: InquiryTrip | null;
};

export type InquiryTrip = {
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
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
      /**
       * T57: true when the question was added to the guest's open thread on
       * this listing instead of starting a new one.
       */
      continued: boolean;
      hostNotification: NotifyOutcome;
      /** The guest's receipt email (none for a duplicate; error if it threw). */
      guestConfirmation: GuestConfirmOutcome | "none" | "error";
    }
  | {
      ok: false;
      status: 400 | 404 | 422;
      code: "invalid" | "links" | "spam" | "not_found";
      error: string;
    }
  | InquiryRateLimited;

export type InquiryRateLimited = {
  ok: false;
  status: 429;
  code: "rate_limited" | "duplicate_blast";
  error: string;
  /** The limit that was hit (stable id, count, window). */
  limit: RateLimitName;
  /** Seconds until that limit has room again (also sent as Retry-After). */
  retryAfterSeconds: number;
};

const TOO_MANY_TEXT = "Too many messages right now. Please try again later.";

function tooMany(
  limit: RateLimitName,
  retryAfterSeconds: number,
  code: InquiryRateLimited["code"] = "rate_limited",
  error = TOO_MANY_TEXT,
): InquiryRateLimited {
  return {
    ok: false,
    status: 429,
    code,
    error,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
  };
}

type IpRule = RateLimitName & { key: string; windowMs: number };

function ipRules(ip: string): IpRule[] {
  const ipKey = `inquiry:${ip}`;
  return [
    {
      key: `${ipKey}:10m`,
      name: "ip_per_10_minutes",
      max: INQUIRY_RATE_LIMITS.ipPer10Min,
      windowMs: 10 * 60_000,
      windowSeconds: 10 * 60,
    },
    {
      key: `${ipKey}:day`,
      name: "ip_per_day",
      max: INQUIRY_RATE_LIMITS.ipPerDay,
      windowMs: DAY,
      windowSeconds: DAY / 1000,
    },
  ];
}

const limitOf = (r: RateLimitName): RateLimitName => ({
  name: r.name,
  max: r.max,
  windowSeconds: r.windowSeconds,
});

/** Seconds until the oldest counted row leaves the window. */
async function dbRetryAfter(
  where: Record<string, unknown>,
  windowMs: number,
  now: Date,
): Promise<number> {
  try {
    const oldest = await prisma.conversation.findFirst({
      where,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (oldest?.createdAt) {
      return (oldest.createdAt.getTime() + windowMs - now.getTime()) / 1000;
    }
  } catch (e) {
    console.error("[inquiry:retry-after]", e);
  }
  return windowMs / 1000;
}

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

  // Per-sender IP (in memory; Railway runs one web process). Checked here,
  // but counted only once we know this is not a duplicate re-send.
  const rules = ipRules(ctx.ip);
  for (const rule of rules) {
    const peek = rateLimitPeek(rule.key, rule.max);
    if (!peek.allowed) return tooMany(limitOf(rule), peek.retryAfterSeconds);
  }
  const countIp = () => {
    for (const rule of rules) rateLimitHit(rule.key, rule.max, rule.windowMs);
  };

  // Resolve the listing or host.
  let hostId: string;
  let propertyId: string | null = null;
  let propertyTitle: string | null = null;
  let propertySlug: string | null = null;
  let hostName: string;
  if (input.propertyId || input.propertySlug) {
    const property = await prisma.property.findFirst({
      where: input.propertyId
        ? { id: input.propertyId, published: true, archivedAt: null }
        : { slug: input.propertySlug!, ...marketplacePropertyWhere() },
      select: {
        id: true,
        slug: true,
        title: true,
        hostId: true,
        host: { select: { name: true } },
      },
    });
    if (!property) {
      countIp();
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
    propertySlug = property.slug;
    hostName = property.host.name;
  } else if (input.hostId) {
    const host = await prisma.host.findUnique({
      where: { id: input.hostId },
      select: { id: true, name: true, active: true },
    });
    if (!host || !host.active) {
      countIp();
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
    countIp();
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
    const dupCheck = rateLimitHit(
      `inquiry:${ctx.ip}:dup`,
      INQUIRY_RATE_LIMITS.ipDuplicatesPer10Min,
      10 * 60_000,
    );
    if (!dupCheck.allowed) {
      return tooMany(
        {
          name: "ip_duplicates_per_10_minutes",
          max: INQUIRY_RATE_LIMITS.ipDuplicatesPer10Min,
          windowSeconds: 10 * 60,
        },
        dupCheck.retryAfterSeconds,
      );
    }
    return {
      ok: true,
      conversationId: dup.id,
      duplicate: true,
      continued: false,
      hostNotification: "none",
      guestConfirmation: "none",
    };
  }

  // Not a duplicate: this request now counts toward the per-IP limits.
  countIp();

  const hash = inquiryHash(body);
  if (body.split(/\s+/).length >= 12) {
    const sameTextWhere = {
      hostId,
      inquiryHash: hash,
      createdAt: { gte: since24h },
    };
    const sameText = await prisma.conversation.count({ where: sameTextWhere });
    if (sameText >= INQUIRY_RATE_LIMITS.sameTextSendersPerDay) {
      return tooMany(
        {
          name: "same_text_per_host_per_day",
          max: INQUIRY_RATE_LIMITS.sameTextSendersPerDay,
          windowSeconds: DAY / 1000,
        },
        await dbRetryAfter(sameTextWhere, DAY, now),
        "duplicate_blast",
        "This host already received this exact message several times today.",
      );
    }
  }

  // Per-email, per-listing, per-host limits (stored in the DB, so they hold
  // across restarts).
  const since1h = new Date(now.getTime() - HOUR);
  const inquiryOnly = { inquirySource: { not: null } };
  const byEmail = { guestEmail: { equals: guestEmail, mode: "insensitive" } };
  const dbRules: (RateLimitName & {
    windowMs: number;
    where: Record<string, unknown> | null;
  })[] = [
    {
      name: "email_per_hour",
      max: INQUIRY_RATE_LIMITS.emailPerHour,
      windowMs: HOUR,
      windowSeconds: HOUR / 1000,
      where: { ...inquiryOnly, ...byEmail, createdAt: { gte: since1h } },
    },
    {
      name: "email_per_day",
      max: INQUIRY_RATE_LIMITS.emailPerDay,
      windowMs: DAY,
      windowSeconds: DAY / 1000,
      where: { ...inquiryOnly, ...byEmail, createdAt: { gte: since24h } },
    },
    {
      name: "listing_per_hour",
      max: INQUIRY_RATE_LIMITS.listingPerHour,
      windowMs: HOUR,
      windowSeconds: HOUR / 1000,
      where: propertyId
        ? { ...inquiryOnly, propertyId, createdAt: { gte: since1h } }
        : null,
    },
    {
      name: "host_per_hour",
      max: INQUIRY_RATE_LIMITS.hostPerHour,
      windowMs: HOUR,
      windowSeconds: HOUR / 1000,
      where: { ...inquiryOnly, hostId, createdAt: { gte: since1h } },
    },
    {
      name: "host_per_day",
      max: INQUIRY_RATE_LIMITS.hostPerDay,
      windowMs: DAY,
      windowSeconds: DAY / 1000,
      where: { ...inquiryOnly, hostId, createdAt: { gte: since24h } },
    },
  ];
  const counts = await Promise.all(
    dbRules.map((r) =>
      r.where
        ? prisma.conversation.count({ where: r.where })
        : Promise.resolve(0),
    ),
  );
  const hit = dbRules.findIndex((r, i) => counts[i]! >= r.max);
  if (hit >= 0) {
    const rule = dbRules[hit]!;
    return tooMany(
      limitOf(rule),
      await dbRetryAfter(rule.where!, rule.windowMs, now),
    );
  }

  // A booking link is kept only when this sender owns that booking.
  let bookingId: string | null = null;
  let bookingTrip: InquiryTrip | null = null;
  if (input.bookingId && ctx.source === "WEB") {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        propertyId: true,
        checkIn: true,
        checkOut: true,
        guests: true,
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
    if (owns && booking) {
      bookingId = booking.id;
      bookingTrip = {
        checkIn: booking.checkIn.toISOString().slice(0, 10),
        checkOut: booking.checkOut.toISOString().slice(0, 10),
        guests: booking.guests,
      };
    }
  }
  const trip = bookingTrip ?? parseTrip(input.trip ?? {});

  const agentName = ctx.agentName?.trim().slice(0, 80) || null;
  const subject =
    subjectIn ||
    (propertyTitle
      ? `Question about ${propertyTitle}`
      : `Message for ${hostName}`);

  // T57: a repeat question from the same email on the same listing (same
  // brand) continues the guest's most recent open thread, unless it is about
  // a materially different stay (see datesDifferMaterially) or a different
  // booking. Archived threads are never reopened.
  const openThread = propertyId
    ? await prisma.conversation.findFirst({
        where: {
          hostId,
          propertyId,
          status: "OPEN",
          opsAlert: false,
          guestEmail: { equals: guestEmail, mode: "insensitive" },
        },
        orderBy: [
          { lastMessageAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        select: {
          id: true,
          bookingId: true,
          guestUserId: true,
          guestPhone: true,
          messages: {
            where: { senderRole: "GUEST" },
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { body: true },
          },
        },
      })
    : null;
  const continueThread =
    openThread &&
    !(bookingId && openThread.bookingId && bookingId !== openThread.bookingId) &&
    !datesDifferMaterially(
      tripFromMessages(openThread.messages.map((m) => m.body)),
      trip,
    )
      ? openThread
      : null;

  if (continueThread) {
    // Keep the per-email hourly cap meaningful for follow-ups too.
    const recentInThread = await prisma.message.count({
      where: {
        conversationId: continueThread.id,
        senderRole: "GUEST",
        createdAt: { gte: since1h },
      },
    });
    if (recentInThread >= INQUIRY_RATE_LIMITS.emailPerHour) {
      return tooMany(
        {
          name: "email_per_hour",
          max: INQUIRY_RATE_LIMITS.emailPerHour,
          windowSeconds: HOUR / 1000,
        },
        HOUR / 1000,
      );
    }
    await prisma.conversation.update({
      where: { id: continueThread.id },
      data: {
        lastMessageAt: now,
        ...(bookingId && !continueThread.bookingId ? { bookingId } : {}),
        ...(ctx.sessionUserId && !continueThread.guestUserId
          ? { guestUserId: ctx.sessionUserId }
          : {}),
        ...(guestPhone && !continueThread.guestPhone ? { guestPhone } : {}),
        messages: {
          create: {
            senderRole: "GUEST",
            senderUserId: ctx.sessionUserId || undefined,
            body,
            channel: "IN_APP",
            // The host is emailed for the follow-up like any guest reply.
            hostNotifyPending: true,
          },
        },
      },
      select: { id: true },
    });
  }

  const conversation = continueThread
    ? { id: continueThread.id }
    : await prisma.conversation.create({
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

  // Short receipt to the guest (capped per address; see guest-confirm.ts).
  let guestConfirmation: GuestConfirmOutcome | "error" = "error";
  try {
    guestConfirmation = await sendGuestInquiryConfirmation({
      conversationId: conversation.id,
      guestEmail,
      guestUserId: ctx.sessionUserId || null,
      hostName,
      propertyTitle,
      propertySlug,
      trip,
      message: body,
      now,
    });
  } catch (e) {
    console.error("[inquiry:guest-confirm]", e);
  }

  return {
    ok: true,
    conversationId: conversation.id,
    duplicate: false,
    continued: Boolean(continueThread),
    hostNotification,
    guestConfirmation,
  };
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Days either end of a stay may move and still be "the same trip" (T57). */
export const SAME_TRIP_TOLERANCE_DAYS = 3;

/**
 * Pure: the latest trip dates a guest gave in a thread, from the
 * "Dates: A to B" / "Check-in: A" context line. Newest message first.
 */
export function tripFromMessages(bodiesNewestFirst: string[]): InquiryTrip | null {
  for (const b of bodiesNewestFirst) {
    const range = /Dates: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/.exec(b);
    if (range) return { checkIn: range[1]!, checkOut: range[2]!, guests: null };
    const ci = /Check-in: (\d{4}-\d{2}-\d{2})/.exec(b);
    if (ci) return { checkIn: ci[1]!, checkOut: null, guests: null };
  }
  return null;
}

const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

/**
 * Pure (T57): true when two trips are clearly different stays: check-in, or
 * check-out when both have one, moved more than SAME_TRIP_TOLERANCE_DAYS.
 * Unknown dates on either side never split a thread.
 */
export function datesDifferMaterially(
  previous: InquiryTrip | null,
  next: InquiryTrip | null,
): boolean {
  if (!previous?.checkIn || !next?.checkIn) return false;
  if (dayDiff(previous.checkIn, next.checkIn) > SAME_TRIP_TOLERANCE_DAYS) return true;
  if (
    previous.checkOut &&
    next.checkOut &&
    dayDiff(previous.checkOut, next.checkOut) > SAME_TRIP_TOLERANCE_DAYS
  ) {
    return true;
  }
  return false;
}

/** Pure: keep only valid trip details (YYYY-MM-DD dates, 1-50 guests). */
export function parseTrip(b: {
  checkIn?: unknown;
  checkOut?: unknown;
  guests?: unknown;
}): InquiryTrip | null {
  const ci =
    typeof b.checkIn === "string" && YMD.test(b.checkIn) ? b.checkIn : null;
  const co =
    ci && typeof b.checkOut === "string" && YMD.test(b.checkOut)
      ? b.checkOut
      : null;
  const g = b.guests == null || b.guests === "" ? NaN : Number(b.guests);
  const guests = Number.isInteger(g) && g > 0 && g <= 50 ? g : null;
  if (!ci && guests == null) return null;
  return { checkIn: ci, checkOut: co, guests };
}

/** Pure: optional trip details become a first line the host can read. */
export function tripContextLine(b: {
  checkIn?: unknown;
  checkOut?: unknown;
  guests?: unknown;
}): string | null {
  const t = parseTrip(b);
  if (!t) return null;
  const parts: string[] = [];
  if (t.checkIn && t.checkOut) parts.push(`Dates: ${t.checkIn} to ${t.checkOut}`);
  else if (t.checkIn) parts.push(`Check-in: ${t.checkIn}`);
  if (t.guests != null) parts.push(`Guests: ${t.guests}`);
  return parts.length ? parts.join(" · ") : null;
}
