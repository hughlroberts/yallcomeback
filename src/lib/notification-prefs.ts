/**
 * Message delivery preferences + unsubscribe tokens.
 * Used by email footers, profile UI, and outbound dispatch.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { messagingSiteOrigin } from "@/lib/messaging";

export type NotifyChannel = "email" | "sms";

function secret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.CRON_SECRET ||
    "dev-notification-secret-change-me"
  );
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").trim();
}

/** Signed unsubscribe token (no login required). Valid ~1 year. */
export function createUnsubscribeToken(
  emailOrPhone: string,
  channel: NotifyChannel,
): string {
  const payload = {
    v: 1,
    c: channel,
    a: channel === "email" ? normalizeEmail(emailOrPhone) : normalizePhone(emailOrPhone),
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    createHmac("sha256", secret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { ok: true; channel: NotifyChannel; address: string } | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "Invalid link" };
  const [body, sig] = parts;
  const expected = b64url(
    createHmac("sha256", secret()).update(body).digest(),
  );
  try {
    const a = fromB64url(sig);
    const b = fromB64url(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "Invalid or tampered link" };
    }
  } catch {
    return { ok: false, error: "Invalid link" };
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as {
      v?: number;
      c?: string;
      a?: string;
      exp?: number;
    };
    if (payload.v !== 1 || !payload.a || (payload.c !== "email" && payload.c !== "sms")) {
      return { ok: false, error: "Invalid link" };
    }
    if (payload.exp && payload.exp < Date.now()) {
      return { ok: false, error: "This link has expired" };
    }
    return {
      ok: true,
      channel: payload.c,
      address: payload.a,
    };
  } catch {
    return { ok: false, error: "Invalid link" };
  }
}

export function unsubscribeUrl(
  emailOrPhone: string,
  channel: NotifyChannel,
): string {
  const token = createUnsubscribeToken(emailOrPhone, channel);
  const origin = messagingSiteOrigin();
  return `${origin}/notifications/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Apply opt-out (and mirror onto User if they have an account). */
export async function applyChannelOptOut(opts: {
  channel: NotifyChannel;
  address: string;
  source?: string;
}): Promise<void> {
  const source = opts.source || "unsubscribe";
  if (opts.channel === "email") {
    const email = normalizeEmail(opts.address);
    if (!email.includes("@")) return;
    await prisma.messageDeliveryOptOut.upsert({
      where: { email },
      create: {
        email,
        emailOptOut: true,
        source,
      },
      update: {
        emailOptOut: true,
        source,
      },
    });
    await prisma.user.updateMany({
      where: { email },
      data: { emailNotifications: false },
    });
    return;
  }

  const phone = normalizePhone(opts.address);
  if (!phone) return;
  await prisma.messageDeliveryOptOut.upsert({
    where: { phone },
    create: {
      phone,
      smsOptOut: true,
      source,
    },
    update: {
      smsOptOut: true,
      source,
    },
  });
  await prisma.user.updateMany({
    where: { phone },
    data: { smsNotifications: false },
  });
}

/** Clear opt-out when user re-enables in profile. */
export async function clearChannelOptOut(opts: {
  channel: NotifyChannel;
  address: string;
}): Promise<void> {
  if (opts.channel === "email") {
    const email = normalizeEmail(opts.address);
    const row = await prisma.messageDeliveryOptOut.findUnique({
      where: { email },
    });
    if (row) {
      await prisma.messageDeliveryOptOut.update({
        where: { email },
        data: { emailOptOut: false, source: "profile" },
      });
    }
    return;
  }
  const phone = normalizePhone(opts.address);
  if (!phone) return;
  const row = await prisma.messageDeliveryOptOut.findUnique({
    where: { phone },
  });
  if (row) {
    await prisma.messageDeliveryOptOut.update({
      where: { phone },
      data: { smsOptOut: false, source: "profile" },
    });
  }
}

export async function canSendEmailTo(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e.includes("@")) return false;
  const user = await prisma.user.findUnique({
    where: { email: e },
    select: { emailNotifications: true },
  });
  if (user && !user.emailNotifications) return false;
  const row = await prisma.messageDeliveryOptOut.findUnique({
    where: { email: e },
    select: { emailOptOut: true },
  });
  if (row?.emailOptOut) return false;
  return true;
}

export async function canSendSmsTo(opts: {
  phone?: string | null;
  email?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  if (opts.userId) {
    const u = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { smsNotifications: true, phone: true },
    });
    if (u && !u.smsNotifications) return false;
  }
  if (opts.email) {
    const e = normalizeEmail(opts.email);
    const u = await prisma.user.findUnique({
      where: { email: e },
      select: { smsNotifications: true },
    });
    if (u && !u.smsNotifications) return false;
  }
  const phone = opts.phone ? normalizePhone(opts.phone) : "";
  if (!phone) return false;
  const row = await prisma.messageDeliveryOptOut.findUnique({
    where: { phone },
    select: { smsOptOut: true },
  });
  if (row?.smsOptOut) return false;
  return true;
}
