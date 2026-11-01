import { prisma } from "@/lib/db";
import { dispatchEmail } from "@/lib/messaging";
import { hostEmailRecipients } from "@/lib/host-recipients";

/**
 * Host emails for pre-booking questions, throttled per host:
 * - the first question after a quiet spell is emailed right away;
 * - later ones wait and go out together as one digest, at most one email
 *   per DIGEST_MINUTES (HEAVY_DIGEST_MINUTES when volume is high);
 * - never more than DAILY_EMAIL_CAP emails per host per 24 hours.
 * Every question is always saved to the /admin/messages inbox regardless.
 */
export const DIGEST_MINUTES = 15;
export const HEAVY_DIGEST_MINUTES = 60;
/** Questions in the last hour that switch a host to the slower digest. */
export const HEAVY_VOLUME_PER_HOUR = 20;
export const DAILY_EMAIL_CAP = 24;
/** Questions quoted in one digest; the rest are summarized as a count. */
export const DIGEST_PREVIEW_MAX = 15;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every host on the brand who has email on (see host-recipients.ts). */
export async function hostNotifyEmails(hostId: string): Promise<string[]> {
  return hostEmailRecipients(hostId);
}

export type NotifyOutcome = "emailed" | "queued" | "none";

/** Pure: may this host get an email now? */
export function notifyDecision(opts: {
  now: Date;
  lastEmailAt: Date | null;
  dayStartedAt: Date | null;
  emailsToday: number;
  recentQuestions: number;
}): { send: boolean; intervalMs: number; resetDay: boolean; waitMs: number } {
  const intervalMs =
    (opts.recentQuestions >= HEAVY_VOLUME_PER_HOUR
      ? HEAVY_DIGEST_MINUTES
      : DIGEST_MINUTES) * 60_000;
  const now = opts.now.getTime();
  const resetDay =
    !opts.dayStartedAt || now - opts.dayStartedAt.getTime() >= DAY_MS;
  const sentToday = resetDay ? 0 : opts.emailsToday;
  if (sentToday >= DAILY_EMAIL_CAP) {
    const waitMs = opts.dayStartedAt!.getTime() + DAY_MS - now;
    return { send: false, intervalMs, resetDay, waitMs: Math.max(waitMs, 0) };
  }
  if (!opts.lastEmailAt) return { send: true, intervalMs, resetDay, waitMs: 0 };
  const since = now - opts.lastEmailAt.getTime();
  if (since >= intervalMs)
    return { send: true, intervalMs, resetDay, waitMs: 0 };
  return { send: false, intervalMs, resetDay, waitMs: intervalMs - since };
}

type PendingMessage = {
  id: string;
  body: string;
  createdAt: Date;
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

/** Pure: subject/body for one question or a digest. */
export function composeInquiryEmail(
  hostName: string,
  pending: PendingMessage[],
  totalPending: number,
): { subject: string; body: string; replyPath: string; single: boolean } {
  if (totalPending === 1 && pending.length === 1) {
    const m = pending[0];
    const c = m.conversation;
    const about = c.property?.title ?? hostName;
    return {
      single: true,
      subject: `New question · ${about}`,
      body: `${c.guestName} (${c.guestEmail}) asked about ${about}${sourceNote(c)}:\n\n${m.body}\n\nReply from your inbox. More questions in the next ${DIGEST_MINUTES} minutes are grouped into one email.`,
      replyPath: `/admin/messages/${c.id}`,
    };
  }
  const lines = pending.map((m) => {
    const c = m.conversation;
    const about = c.property?.title ? ` about ${c.property.title}` : "";
    return `• ${c.guestName} (${c.guestEmail})${about}${sourceNote(c)}:\n  "${snippet(m.body)}"`;
  });
  const more = totalPending - pending.length;
  return {
    single: false,
    subject: `${totalPending} new guest questions · ${hostName}`,
    body: `You have ${totalPending} new questions from guests.\n\n${lines.join("\n\n")}${
      more > 0 ? `\n\n…and ${more} more in your inbox.` : ""
    }\n\nOpen your inbox to reply. Questions are grouped so you get at most one email every ${DIGEST_MINUTES} minutes.`,
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
 * Email whatever is pending for this host if the throttle allows it;
 * otherwise leave it queued (a timer and the cron runner send it later).
 */
export async function flushHostInquiryEmails(
  hostId: string,
  now = new Date(),
): Promise<NotifyOutcome> {
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
  const recentQuestions = await prisma.conversation.count({
    where: {
      hostId,
      inquirySource: { not: null },
      createdAt: { gte: new Date(now.getTime() - 60 * 60_000) },
    },
  });
  const d = notifyDecision({
    now,
    lastEmailAt: state.lastEmailAt,
    dayStartedAt: state.dayStartedAt,
    emailsToday: state.emailsToday,
    recentQuestions,
  });
  if (!d.send) {
    scheduleFlush(hostId, d.waitMs);
    return "queued";
  }

  // Claim the slot atomically so two requests can't both email.
  const claimed = await prisma.inquiryNotifyState.updateMany({
    where: {
      hostId,
      lastEmailAt: state.lastEmailAt,
      emailsToday: state.emailsToday,
    },
    data: d.resetDay
      ? { lastEmailAt: now, dayStartedAt: now, emailsToday: 1 }
      : { lastEmailAt: now, emailsToday: { increment: 1 } },
  });
  if (claimed.count === 0) return "queued";

  const pending = (await prisma.message.findMany({
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
        },
      },
    },
  })) as PendingMessage[];
  if (pending.length === 0) return "none";

  await prisma.message.updateMany({
    where: { id: { in: pending.map((m) => m.id) }, hostNotifyPending: true },
    data: { hostNotifyPending: false },
  });

  const email = composeInquiryEmail(
    host.name,
    pending.slice(0, DIGEST_PREVIEW_MAX),
    Math.max(totalPending, pending.length),
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

/** Cron: send any digests whose window has passed. */
export async function flushAllPendingInquiryEmails(): Promise<{
  hosts: number;
  emailed: number;
}> {
  const rows = await prisma.conversation.findMany({
    where: { messages: { some: { hostNotifyPending: true } } },
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
