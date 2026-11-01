import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Per-thread reply addresses ("one thread for email and messages").
 *
 * Outgoing stay mail gets Reply-To: reply+<token>@INBOUND_EMAIL_DOMAIN. The
 * token names the thread (a conversation, or a booking whose thread is made
 * on first reply), who the email was sent to (guest or host), and an HMAC so
 * nobody can forge an address for another thread.
 *
 * Env (names only; never log values):
 * - INBOUND_EMAIL_DOMAIN           domain whose MX points at Resend inbound
 * - INBOUND_EMAIL_TOKEN_SECRET     HMAC key for reply tokens (32+ random chars)
 * - RESEND_INBOUND_WEBHOOK_SECRET  signing secret of the Resend webhook
 * plus the existing Resend API key (to read the received email).
 * If any is missing the feature is off: emails keep today's Reply-To and the
 * webhook answers 404.
 */

export type ReplyKind = "c" | "b";
export type ReplyRole = "GUEST" | "HOST";

const LOCAL_PREFIX = "reply";
const SIG_HEX = 20; // 80 bits; local part stays under 64 chars
const ID_RE = /^[a-z0-9]{8,40}$/;

function domain(): string | null {
  const d = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase() || "";
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}

function tokenSecret(): string | null {
  const s = process.env.INBOUND_EMAIL_TOKEN_SECRET?.trim() || "";
  return s.length >= 16 ? s : null;
}

export function inboundWebhookSecret(): string | null {
  return process.env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() || null;
}

function resendKey(): string | null {
  return (
    process.env.MESSAGING_EMAIL_API_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    null
  );
}

/** All settings present: reply-by-email is on. */
export function isInboundEmailEnabled(): boolean {
  return Boolean(
    domain() && tokenSecret() && inboundWebhookSecret() && resendKey(),
  );
}

function sign(secret: string, kind: ReplyKind, role: ReplyRole, id: string) {
  return createHmac("sha256", secret)
    .update(`ycb-reply:${kind}:${role}:${id}`)
    .digest("hex")
    .slice(0, SIG_HEX);
}

const ROLE_CODE: Record<ReplyRole, string> = { GUEST: "g", HOST: "h" };

/** reply+c-h-<id>-<sig>@domain, or null when the feature is off. */
export function replyAddressFor(
  kind: ReplyKind,
  id: string,
  role: ReplyRole,
): string | null {
  if (!isInboundEmailEnabled()) return null;
  const d = domain()!;
  const secret = tokenSecret()!;
  const lid = id.toLowerCase();
  if (!ID_RE.test(lid)) return null;
  return `${LOCAL_PREFIX}+${kind}-${ROLE_CODE[role]}-${lid}-${sign(secret, kind, role, lid)}@${d}`;
}

/** Parse and verify a reply address. Null for anything not ours or forged. */
export function parseReplyAddress(
  address: string,
): { kind: ReplyKind; role: ReplyRole; id: string } | null {
  const d = domain();
  const secret = tokenSecret();
  if (!d || !secret) return null;
  const a = address.trim().toLowerCase();
  const m = a.match(
    /^reply\+([cb])-([gh])-([a-z0-9]{8,40})-([0-9a-f]+)@([a-z0-9.-]+)$/,
  );
  if (!m || m[5] !== d) return null;
  const kind = m[1] as ReplyKind;
  const role: ReplyRole = m[2] === "g" ? "GUEST" : "HOST";
  const id = m[3];
  const want = Buffer.from(sign(secret, kind, role, id));
  const got = Buffer.from(m[4]);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  return { kind, role, id };
}
