import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/messaging";
import { hostEmailRecipients } from "@/lib/host-recipients";

/**
 * Host emails for guest messages (new questions and guest replies):
 * - every message is emailed to the hosts and co-hosts right away;
 * - flood guard: after FLOOD_INSTANT_MAX emails to one host inside a
 *   FLOOD_WINDOW_MINUTES window, later messages wait and go out together as
 *   one digest when that window ends;
 * - safety cap: at most DAILY_EMAIL_CAP emails per host per 24 hours. Anything
 *   over it is logged and held until the day resets.
 * Every message is always saved to the /admin/messages inbox regardless.
 */
export const FLOOD_WINDOW_MINUTES = 10;
/** Instant emails allowed per host per window before messages are bundled. */
export const FLOOD_INSTANT_MAX = 10;
export const DAILY_EMAIL_CAP = 200;
/** Messages quoted in one digest; the rest are summarized as a count. */
export const DIGEST_PREVIEW_MAX = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = FLOOD_WINDOW_MINUTES * 60_000;

/** Every host on the brand who has email on (see host-recipients.ts). */
export async function hostNotifyEmails(hostId: string): Promise<string[]> {
  return hostEmailRecipients(hostId);
}

export type NotifyOutcome = "emailed" | "queued" | "none";

/** Pure: may this host get an email now? */
export function notifyDecision(opts: {
  now: Date;
  windowStartedAt: Date | null;
  windowCount: number;
  dayStartedAt: Date | null;
  emailsToday: number;
}): {
  send: boolean;
  reason: "ok" | "flood" | "daily_cap";
  resetDay: boolean;
  resetWindow: boolean;
  waitMs: number;
} {
  const now = opts.now.getTime();
  const resetDay =
    !opts.dayStartedAt || now - opts.dayStartedAt.getTime() >= DAY_MS;
  const resetWindow =
    !opts.windowStartedAt || now - opts.windowStartedAt.getTime() >= WINDOW_MS;
  const sentToday = resetDay ? 0 : opts.emailsToday;
  if (sentToday >= DAILY_EMAIL_CAP) {
    const waitMs = opts.dayStartedAt!.getTime() + DAY_MS - now;
    return {
      send: false,
      reason: "daily_cap",
      resetDay,
      resetWindow,
      waitMs: Math.max(waitMs, 0),
    };
  }
  if (resetWindow || opts.windowCount < FLOOD_INSTANT_MAX) {
    return { send: true, reason: "ok", resetDay, resetWindow, waitMs: 0 };
  }
  return {
    send: false,
    reason: "flood",
    resetDay,
    resetWindow,
    waitMs: Math.max(opts.windowStartedAt!.getTime() + WINDOW_MS - now, 0),
  };
}

export type PendingMessage = {
  id: string;
  body: string;
  createdAt: Date;
  /** A later guest message in an existing thread (not the first question). */
  isReply?: boolean;
  conversation: {
    id: string;
    guestName: string;
    guestEmail: string;
    inquirySource: string | null;
    inquiryAgent: string | null;
    property: { title: string } | null;
  };
};

function snippet(text: string, max = 280): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function sourceNote(c: PendingMessage["conversation"]): string {
  if (c.inquirySource !== "AGENT") return "";
  return c.inquiryAgent
    ? ` (sent by an AI assistant: ${c.inquiryAgent})`
    : " (sent by an AI assistant)";
}

/** Pure: subject/body for one message or a flood digest. */
export function composeInquiryEmail(
  hostName: string,
  pending: PendingMessage[],
  totalPending: number,
): { subject: string; body: string; replyPath: string; single: boolean } {
  if (totalPending === 1 && pending.length === 1) {
    const m = pending[0];
    const c = m.conversation;
    if (m.isReply) {
      const title = c.property?.title || "your stay";
      return {
        single: true,
        subject: `Guest reply · ${title}`,
        body: `${c.guestName} wrote:\n\n${m.body}`,
        replyPath: `/admin/messages/${c.id}`,
      };
    }
    const about = c.property?.title ?? hostName;
    return {
      single: true,
      subject: `New question · ${about}`,
      body: `${c.guestName} (${c.guestEmail}) asked about ${about}${sourceNote(c)}:\n\n${m.body}`,
      replyPath: `/admin/messages/${c.id}`,
    };
  }
  const lines = pending.map((m) => {
    const c = m.conversation;
    const about = c.property?.title ? ` about ${c.property.title}` : "";
    const verb = m.isReply ? "replied" : "asked";
    return `• ${c.guestName} (${c.guestEmail}) ${verb}${about}${sourceNote(c)}:\n  "${snippet(m.body)}"`;
  });
  const more = totalPending - pending.length;
  return {
    single: false,
    subject: `${totalPending} new guest messages · ${hostName}`,
    body: `You have ${totalPending} new messages from guests.\n\n${lines.join("\n\n")}${
      more > 0 ? `\n\n…and ${more} more in your inbox.` : ""
    }\n\nA lot of messages arrived at once, so these were grouped into one email. Open your inbox to reply.`,
    replyPath: "/admin/messages",
  };
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleFlush(hostId: string, waitMs: number) {
  if (timers.has(hostId)) return;
  const t = setTimeout(
    () => {
      timers.delete(hostId);
      void flushHostInquiryEmails(hostId).catch((e) =>
        console.error("[inquiry-notify:timer]", e),
      );
    },
    Math.min(Math.max(waitMs, 1_000) + 1_000, DAY_MS),
  );
  if (typeof t === "object" && t && "unref" in t) t.unref();
  timers.set(hostId, t);
}

/**
 * Email whatever guest messages are pending for this host, unless the flood
 * guard or daily cap says wait (a timer and the cron runner send them later).
 */
export async function flushHostInquiryEmails(
  hostId: string,
  now = new Date(),
): Promise<NotifyOutcome> {
  // Two submits at once race for the same state row; retry the claim a few
  // times so neither message is left waiting for the cron.
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await flushOnce(hostId, now);
    if (r !== "retry") return r;
  }
  return "queued";
}

async function flushOnce(
  hostId: string,
  now: Date,
): Promise<NotifyOutcome | "retry"> {
  const pendingWhere = {
    hostNotifyPending: true,
    senderRole: "GUEST",
    conversation: { hostId },
  };
  const totalPending = await prisma.message.count({ where: pendingWhere });
  if (totalPending === 0) return "none";

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { id: true, name: true },
  });
  if (!host) return "none";

  const state = await prisma.inquiryNotifyState.upsert({
    where: { hostId },
    create: { hostId },
    update: {},
  });
  const d = notifyDecision({
    now,
    windowStartedAt: state.windowStartedAt,
    windowCount: state.windowCount,
    dayStartedAt: state.dayStartedAt,
    emailsToday: state.emailsToday,
  });
  if (!d.send) {
    if (d.reason === "daily_cap") {
      console.warn("[inquiry-notify:daily-cap]", {
        hostId,
        held: totalPending,
        cap: DAILY_EMAIL_CAP,
        resumesInMin: Math.ceil(d.waitMs / 60_000),
      });
    }
    scheduleFlush(hostId, d.waitMs);
    return "queued";
  }

  // Claim the slot atomically so two requests can't both email.
  const claimed = await prisma.inquiryNotifyState.updateMany({
    where: {
      hostId,
      windowStartedAt: state.windowStartedAt,
      windowCount: state.windowCount,
      emailsToday: state.emailsToday,
    },
    data: {
      lastEmailAt: now,
      ...(d.resetDay
        ? { dayStartedAt: now, emailsToday: 1 }
        : { emailsToday: { increment: 1 } }),
      ...(d.resetWindow
        ? { windowStartedAt: now, windowCount: 1 }
        : { windowCount: { increment: 1 } }),
    },
  });
  if (claimed.count === 0) return "retry";

  const rows = await prisma.message.findMany({
    where: pendingWhere,
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      body: true,
      createdAt: true,
      conversation: {
        select: {
          id: true,
          guestName: true,
          guestEmail: true,
          inquirySource: true,
          inquiryAgent: true,
          property: { select: { title: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });
  // Someone else's claim picked these up between our count and our claim.
  if (rows.length === 0) return "emailed";
  const pending: PendingMessage[] = rows.map((m) => {
    const { messages, ...conversation } = m.conversation;
    return {
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      isReply: messages[0]?.id !== m.id,
      conversation,
    };
  });

  // Only send what we flipped ourselves, so a racing flush can't double-send.
  const flipped = await prisma.message.updateMany({
    where: { id: { in: pending.map((m) => m.id) }, hostNotifyPending: true },
    data: { hostNotifyPending: false },
  });
  if (flipped.count === 0) return "emailed";

  const email = composeInquiryEmail(
    host.name,
    pending.slice(0, DIGEST_PREVIEW_MAX),
    pending.length,
  );
  const first = pending[0].conversation;
  const recipients = await hostNotifyEmails(hostId);
  let status: string | null = null;
  let externalId: string | null = null;
  for (const to of recipients) {
    const r = await dispatchEmail({
      to,
      subject: email.subject,
      body: email.body,
      conversationId: first.id,
      replyPath: email.replyPath,
      fromPartyName: email.single ? first.guestName : null,
      replyTo: email.single ? first.guestEmail : null,
      // One thread: replies to a single-message email land in that thread.
      threadRole: email.single ? "HOST" : undefined,
    });
    if (r.attempted) {
      status = `email:${r.status}${email.single ? "" : ":digest"}`;
      if (r.externalId) externalId = r.externalId;
    }
  }
  if (status) {
    await prisma.message.updateMany({
      where: { id: { in: pending.map((m) => m.id) } },
      data: { externalStatus: status, externalId },
    });
  }
  return recipients.length > 0 ? "emailed" : "none";
}

/** Cron: send anything held by the flood guard or daily cap. */
export async function flushAllPendingInquiryEmails(): Promise<{
  hosts: number;
  emailed: number;
}> {
  const rows = await prisma.conversation.findMany({
    where: {
      messages: { some: { hostNotifyPending: true, senderRole: "GUEST" } },
    },
    select: { hostId: true },
    distinct: ["hostId"],
    take: 500,
  });
  let emailed = 0;
  for (const r of rows) {
    try {
      if ((await flushHostInquiryEmails(r.hostId)) === "emailed") emailed += 1;
    } catch (e) {
      console.error("[inquiry-notify:cron]", e);
    }
  }
  return { hosts: rows.length, emailed };
}
