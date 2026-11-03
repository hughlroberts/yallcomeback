/**
 * Guest ↔ host messaging delivery.
 *
 * In-app always works. Email goes to the guest/host address on each new message
 * when a transport is configured (Resend API key, or SMTP via nodemailer).
 *
 * Envelope is Airbnb-style: we always send from the Yall Come Back address.
 * Stay mail uses "Name via Yall Come Back". Reply-To is only our signed thread
 * address, or the brand's public email when the brand opted in (T18).
 * Never send From a host's personal mailbox.
 *
 * SMS is wired for a future Twilio-style provider; enable only via ops env.
 * Do not surface SMS in guest-facing product copy — ops settings only.
 */

import { randomUUID } from "crypto";
import { canonicalSiteOrigin, PRODUCT_NAME } from "@/lib/features";
import {
  parseReplyAddress,
  replyAddressFor,
  type ReplyRole,
} from "@/lib/inbound/reply-address";

export type ExternalMessageChannel = "SMS" | "EMAIL";

export type DispatchResult = {
  attempted: boolean;
  status: "sent" | "skipped" | "failed" | "not_configured";
  externalId?: string;
  detail?: string;
  channel?: ExternalMessageChannel;
};

/** Absolute origin for inbox links in emails (no request context required). */
export function messagingSiteOrigin(): string {
  return canonicalSiteOrigin();
}

function emailFromAddress(): string | null {
  const from =
    process.env.MESSAGING_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "";
  return from || null;
}

function parseMailbox(raw: string): { name: string | null; address: string } {
  const m = raw.match(/^(.*)<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].trim().replace(/^["']|["']$/g, "");
    return { name: name || null, address: m[2].trim() };
  }
  return { name: null, address: raw.trim() };
}

function sanitizeDisplayName(name: string): string {
  return name
    .replace(/[\r\n<>"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function formatMailbox(name: string, address: string): string {
  const n = sanitizeDisplayName(name);
  if (!n) return address;
  return `${n} <${address}>`;
}

function isUsableEmail(value: string | null | undefined): value is string {
  const v = value?.trim().toLowerCase() || "";
  return Boolean(v && v.includes("@") && !v.includes(" ") && v.length < 254);
}

/**
 * Airbnb-style envelope: we always send from the Yall Come Back address.
 * Stay mail shows "Host Name via Yall Come Back"; Reply-To is the other party.
 * Never send from a host's Gmail/iCloud.
 */
export function stayFromHeader(
  partyName: string | null | undefined,
): string | null {
  const raw = emailFromAddress();
  if (!raw) return null;
  const { address } = parseMailbox(raw);
  if (!address) return null;
  const party = partyName?.trim();
  const display = party
    ? `${sanitizeDisplayName(party)} via ${PRODUCT_NAME}`
    : PRODUCT_NAME;
  return formatMailbox(display, address);
}

export function platformFromHeader(): string | null {
  const raw = emailFromAddress();
  if (!raw) return null;
  const { address, name } = parseMailbox(raw);
  if (!address) return null;
  return formatMailbox(name || PRODUCT_NAME, address);
}

/** Footer for reset / signup / billing mail. Stay threads stay replyable. */
export function platformDoNotReplyLine(): string {
  return `This is an automated message from ${PRODUCT_NAME}. Do not reply to this email — this mailbox is not monitored.`;
}

function withPlatformFooter(text: string, replyable = false): string {
  return `${text.trim()}\n\n${
    replyable
      ? "You can reply to this email. Your reply is added to your message thread on Yall Come Back."
      : platformDoNotReplyLine()
  }`;
}

/**
 * Reply-To guard. Only our own signed thread address (reply+…@inbound) may be
 * a Reply-To. A person's address (a host's contact email or a guest's email)
 * must never go in a header: mail apps show Reply-To as a participant, so the
 * other party would see it. Without a thread address there is no Reply-To,
 * and the email shows only the recipient and the bookings@ sender.
 */
export function safeReplyTo(
  candidate: string | null | undefined,
  to: string,
): string | null {
  const addr = candidate?.trim().toLowerCase() || null;
  if (!addr || !isUsableEmail(addr)) return null;
  if (addr === to.trim().toLowerCase()) return null;
  return parseReplyAddress(addr) ? addr : null;
}

/**
 * The brand opted in ("Show my email to guests"): guest-facing message mail
 * may use the brand's public contact email as Reply-To. Off by default.
 */
export function hostReplyToForGuest(
  host: { contactEmail?: string | null; showEmailToGuests?: boolean | null } | null | undefined,
): string | null {
  if (!host?.showEmailToGuests) return null;
  const addr = host.contactEmail?.trim().toLowerCase() || null;
  return isUsableEmail(addr) ? addr : null;
}

/**
 * Ops / billing mail. Booking emails may pass a per-thread `replyTo`
 * (reply+…@inbound domain); then the footer invites a reply instead of
 * "do not reply".
 */
export async function dispatchPlatformEmail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
}): Promise<DispatchResult> {
  const to = opts.to.trim().toLowerCase();
  if (!isUsableEmail(to)) {
    return {
      attempted: false,
      status: "skipped",
      channel: "EMAIL",
      detail: "Invalid recipient email",
    };
  }
  if (!isEmailMessagingEnabled()) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "EMAIL",
      detail: "Email not configured",
    };
  }
  const from = platformFromHeader();
  if (!from) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "EMAIL",
      detail: "MESSAGING_EMAIL_FROM missing",
    };
  }
  const platformReplyTo = safeReplyTo(opts.replyTo, to);
  const text = withPlatformFooter(opts.text, Boolean(platformReplyTo));
  const html = platformEmailHtml(text);
  if (process.env.MESSAGING_EMAIL_DRY_RUN === "true") {
    console.info("[messaging:email:dry-run:platform]", {
      to,
      subject: opts.subject,
    });
    return {
      attempted: true,
      status: "sent",
      channel: "EMAIL",
      detail: "Dry-run",
    };
  }
  const apiKey = resendApiKey();
  if (apiKey) {
    return sendViaResend({
      from,
      to,
      subject: opts.subject,
      text,
      html,
      apiKey,
      replyTo: platformReplyTo,
      headers: platformHeaders(),
    });
  }
  if (smtpConfigured()) {
    return sendViaSmtp({
      from,
      to,
      subject: opts.subject,
      text,
      html,
      replyTo: platformReplyTo,
      headers: platformHeaders(),
    });
  }
  return {
    attempted: false,
    status: "not_configured",
    channel: "EMAIL",
    detail: "No email transport",
  };
}

function resendApiKey(): string | null {
  return (
    process.env.MESSAGING_EMAIL_API_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    null
  );
}

function smtpConfigured(): boolean {
  return Boolean(
    process.env.MESSAGING_SMTP_HOST?.trim() || process.env.SMTP_HOST?.trim(),
  );
}

/** True when we can actually attempt an outbound email. */
export function hasEmailTransport(): boolean {
  return Boolean(emailFromAddress() && (resendApiKey() || smtpConfigured()));
}

/**
 * Email is on when a transport is configured, unless explicitly disabled.
 * Set MESSAGING_EMAIL_ENABLED=false to force in-app only.
 */
export function isEmailMessagingEnabled(): boolean {
  if (process.env.MESSAGING_EMAIL_ENABLED === "false") return false;
  if (process.env.MESSAGING_EMAIL_ENABLED === "true") {
    return Boolean(emailFromAddress());
  }
  // Auto-enable when operator has provisioned a real transport
  return hasEmailTransport();
}

/** Platform SMS (Twilio-style) — ops-only; off unless fully configured. */
export function isSmsMessagingEnabled(): boolean {
  return (
    process.env.MESSAGING_SMS_ENABLED === "true" &&
    Boolean(process.env.MESSAGING_SMS_FROM?.trim()) &&
    Boolean(process.env.MESSAGING_SMS_PROVIDER_KEY?.trim()) &&
    Boolean(
      process.env.MESSAGING_SMS_ACCOUNT_SID?.trim() ||
      process.env.TWILIO_ACCOUNT_SID?.trim(),
    )
  );
}

/** Headers every email gets. Transactional mail has no List-Unsubscribe. */
function platformHeaders(): Record<string, string> {
  return { "X-Entity-Ref-ID": randomUUID() };
}

/**
 * Message mail headers. List-Unsubscribe + List-Unsubscribe-Post give the
 * one-click "Unsubscribe" button (Gmail / Yahoo sender rules, RFC 8058).
 * X-Entity-Ref-ID stops Gmail from folding separate messages together.
 */
export function messageEmailHeaders(
  oneClickUrl: string | null,
): Record<string, string> {
  const h = platformHeaders();
  if (oneClickUrl) {
    h["List-Unsubscribe"] = `<${oneClickUrl}>`;
    h["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  return h;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** Escape text, then make each URL a link whose text is the same URL. */
export function linkifyText(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(URL_IN_TEXT)) {
    const i = m.index ?? 0;
    out += escapeHtml(text.slice(last, i));
    const url = escapeHtml(m[0]);
    out += `<a href="${url}" style="color:#3a4a86">${url}</a>`;
    last = i + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/** Full HTML document for platform mail (same words as the text part). */
export function platformEmailHtml(text: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1c1917">
  <div style="white-space:pre-wrap;font-size:15px">${linkifyText(text)}</div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailBodies(opts: {
  body: string;
  conversationId: string;
  replyPath?: string;
  /** One-click unsubscribe (always included for marketing compliance) */
  unsubscribeUrl?: string | null;
  /** Reply-To is this thread's inbound address: say replies are welcome. */
  replyByEmail?: boolean;
}): { text: string; html: string } {
  const origin = messagingSiteOrigin();
  const path = opts.replyPath || `/messages/${opts.conversationId}`;
  const url = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const unsub = opts.unsubscribeUrl?.trim() || null;
  const prefsUrl = `${origin}/account/settings/notifications`;
  const text = [
    opts.body,
    "",
    "—",
    opts.replyByEmail
      ? `You can reply to this email, or reply in your inbox: ${url}`
      : `Reply in your inbox: ${url}`,
    unsub ? `Stop message emails: ${unsub}` : null,
    `Notification settings: ${prefsUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1c1917">
  <div style="white-space:pre-wrap;font-size:15px">${linkifyText(opts.body)}</div>
  <p style="margin-top:24px">
    ${opts.replyByEmail ? "You can reply to this email, or " : ""}<a href="${escapeHtml(url)}" style="color:#3a4a86;font-weight:600">${opts.replyByEmail ? "reply in your inbox" : "Reply in your inbox"} →</a>
  </p>
  <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c">
    You received this because someone messaged you on ${escapeHtml(
      PRODUCT_NAME,
    )}.
    ${
      unsub
        ? `<br/><a href="${escapeHtml(unsub)}" style="color:#78716c">Unsubscribe from message emails</a> · `
        : "<br/>"
    }
    <a href="${escapeHtml(prefsUrl)}" style="color:#78716c">Manage notification settings</a>
  </p>
</body></html>`;
  return { text, html };
}

const RESEND_MAX_ATTEMPTS = 3;

/** Seconds from Retry-After / ratelimit-reset, capped (default 1s). */
export function resendRetryDelayMs(headers: Headers, attempt: number): number {
  const raw =
    headers.get("retry-after") ?? headers.get("ratelimit-reset") ?? "";
  const secs = Number(raw);
  const base = Number.isFinite(secs) && secs > 0 ? secs * 1000 : 1000 * attempt;
  return Math.min(base, 5_000);
}

/**
 * POST to Resend, retrying rate limits (429) and server errors (5xx) a
 * couple of times. Several emails go out back to back for one booking (guest
 * + every host), and Resend's per-second limit is shared by the whole team.
 */
async function resendPostWithRetry(
  apiKey: string,
  payload: Record<string, unknown>,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
  let res: Response | null = null;
  for (let attempt = 1; attempt <= RESEND_MAX_ATTEMPTS; attempt++) {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "yallcomeback-app/1.0",
      },
      body: JSON.stringify(payload),
    });
    if (res.status !== 429 && res.status < 500) return res;
    if (attempt < RESEND_MAX_ATTEMPTS) {
      console.warn("[messaging:email:resend] retrying", res.status, attempt);
      await sleep(resendRetryDelayMs(res.headers, attempt));
    }
  }
  return res!;
}

async function sendViaResend(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  apiKey: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
}): Promise<DispatchResult> {
  try {
    const payload: Record<string, unknown> = {
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    };
    if (opts.replyTo) payload.reply_to = [opts.replyTo];
    if (opts.headers && Object.keys(opts.headers).length) {
      payload.headers = opts.headers;
    }
    const res = await resendPostWithRetry(opts.apiKey, payload);
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      console.error("[messaging:email:resend]", res.status, data);
      return {
        attempted: true,
        status: "failed",
        channel: "EMAIL",
        detail: data.message || data.name || `Resend HTTP ${res.status}`,
      };
    }
    return {
      attempted: true,
      status: "sent",
      channel: "EMAIL",
      externalId: data.id,
      detail: "resend",
    };
  } catch (e) {
    console.error("[messaging:email:resend]", e);
    return {
      attempted: true,
      status: "failed",
      channel: "EMAIL",
      detail: e instanceof Error ? e.message : "Resend request failed",
    };
  }
}

async function sendViaSmtp(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
}): Promise<DispatchResult> {
  const host =
    process.env.MESSAGING_SMTP_HOST?.trim() ||
    process.env.SMTP_HOST?.trim() ||
    "";
  const port = Number(
    process.env.MESSAGING_SMTP_PORT || process.env.SMTP_PORT || "587",
  );
  const user =
    process.env.MESSAGING_SMTP_USER?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "";
  const pass =
    process.env.MESSAGING_SMTP_PASS?.trim() ||
    process.env.SMTP_PASS?.trim() ||
    "";
  const secure =
    process.env.MESSAGING_SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "true" ||
    port === 465;

  try {
    // Optional peer — avoid static import so pure Resend deploys need no nodemailer
    const load = new Function("m", "return import(m)") as (
      m: string,
    ) => Promise<{
      default?: {
        createTransport: (opts: Record<string, unknown>) => {
          sendMail: (
            opts: Record<string, unknown>,
          ) => Promise<{ messageId?: string }>;
        };
      };
      createTransport?: (opts: Record<string, unknown>) => {
        sendMail: (
          opts: Record<string, unknown>,
        ) => Promise<{ messageId?: string }>;
      };
    }>;
    const mod = await load("nodemailer");
    const createTransport = mod.createTransport || mod.default?.createTransport;
    if (!createTransport) {
      return {
        attempted: false,
        status: "not_configured",
        channel: "EMAIL",
        detail: "nodemailer not installed — use RESEND_API_KEY instead",
      };
    }
    const transport = createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
    const info = await transport.sendMail({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
    });
    return {
      attempted: true,
      status: "sent",
      channel: "EMAIL",
      externalId: info.messageId,
      detail: "smtp",
    };
  } catch (e) {
    console.error("[messaging:email:smtp]", e);
    return {
      attempted: true,
      status: "failed",
      channel: "EMAIL",
      detail:
        e instanceof Error
          ? e.message
          : "SMTP failed (install nodemailer or use Resend)",
    };
  }
}

/**
 * Send email to a guest or host. Used for conversation replies and booking autos.
 */
export async function dispatchEmail(opts: {
  to: string;
  subject: string;
  body: string;
  conversationId: string;
  /** Override inbox path (e.g. /admin/messages/id for hosts) */
  replyPath?: string;
  /** Skip preference checks (rare; default respects opt-out) */
  force?: boolean;
  /**
   * Stay mail: other party's name (host or guest).
   * From becomes "Name via Yall Come Back <bookings@…>".
   * Omit for platform/ops mail.
   */
  fromPartyName?: string | null;
  /**
   * Who this email goes to in the thread. When reply-by-email is on, Reply-To
   * becomes the thread's own address so the reply lands in /admin/messages.
   */
  threadRole?: ReplyRole;
  /**
   * Only from hostReplyToForGuest(): the brand chose to show its public
   * email to guests. Any other person's address is never a Reply-To.
   */
  hostOptInReplyTo?: string | null;
}): Promise<DispatchResult> {
  const to = opts.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return {
      attempted: false,
      status: "skipped",
      channel: "EMAIL",
      detail: "Invalid recipient email",
    };
  }

  if (!opts.force) {
    const { canSendEmailTo, unsubscribeUrl } =
      await import("@/lib/notification-prefs");
    const allowed = await canSendEmailTo(to);
    if (!allowed) {
      return {
        attempted: false,
        status: "skipped",
        channel: "EMAIL",
        detail: "Recipient opted out of message emails",
      };
    }
    // attach unsub URL via local build below
    void unsubscribeUrl;
  }

  if (!isEmailMessagingEnabled()) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "EMAIL",
      detail:
        "Email not configured. Set MESSAGING_EMAIL_FROM + RESEND_API_KEY (or SMTP).",
    };
  }

  const from = opts.fromPartyName
    ? stayFromHeader(opts.fromPartyName)
    : platformFromHeader();
  if (!from) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "EMAIL",
      detail: "MESSAGING_EMAIL_FROM missing",
    };
  }

  const threadReplyTo = opts.threadRole
    ? replyAddressFor("c", opts.conversationId, opts.threadRole)
    : null;
  // Never a person's address (see safeReplyTo), unless the brand opted in.
  const optIn = opts.hostOptInReplyTo?.trim().toLowerCase() || null;
  const replyTo =
    optIn && isUsableEmail(optIn) && optIn !== to
      ? optIn
      : safeReplyTo(threadReplyTo, to);

  const { unsubscribeUrl, oneClickUnsubscribeUrl } = await import(
    "@/lib/notification-prefs"
  );
  const headers = messageEmailHeaders(oneClickUnsubscribeUrl(to));
  const { text, html } = buildEmailBodies({
    ...opts,
    unsubscribeUrl: unsubscribeUrl(to, "email"),
    replyByEmail: Boolean(replyTo),
  });

  // Explicit dry-run for staging (default off when a real transport exists)
  if (process.env.MESSAGING_EMAIL_DRY_RUN === "true") {
    console.info("[messaging:email:dry-run]", {
      to,
      subject: opts.subject,
      conversationId: opts.conversationId,
      from,
      replyTo,
    });
    return {
      attempted: true,
      status: "sent",
      channel: "EMAIL",
      externalId: `dry-run-email-${Date.now()}`,
      detail: "Dry-run (MESSAGING_EMAIL_DRY_RUN=true)",
    };
  }

  const apiKey = resendApiKey();
  if (apiKey) {
    return sendViaResend({
      from,
      to,
      subject: opts.subject,
      text,
      html,
      apiKey,
      replyTo,
      headers,
    });
  }

  if (smtpConfigured()) {
    return sendViaSmtp({
      from,
      to,
      subject: opts.subject,
      text,
      html,
      replyTo,
      headers,
    });
  }

  // Enabled flag but no transport — log so ops can fix
  console.warn("[messaging:email] enabled but no Resend key or SMTP host");
  return {
    attempted: false,
    status: "not_configured",
    channel: "EMAIL",
    detail: "No email transport (RESEND_API_KEY or MESSAGING_SMTP_HOST)",
  };
}

/**
 * SMS adapter (Twilio). Only runs when ops enables full env set.
 * Keep product UI silent about SMS until this is productized.
 */
export async function dispatchSms(opts: {
  to: string;
  body: string;
  conversationId: string;
}): Promise<DispatchResult> {
  const to = opts.to.trim();
  if (!to) {
    return {
      attempted: false,
      status: "skipped",
      channel: "SMS",
      detail: "No phone number",
    };
  }

  if (!isSmsMessagingEnabled()) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "SMS",
      detail: "SMS not enabled",
    };
  }

  if (process.env.MESSAGING_SMS_DRY_RUN !== "false") {
    console.info("[messaging:sms:dry-run]", {
      to,
      conversationId: opts.conversationId,
      preview: opts.body.slice(0, 80),
    });
    return {
      attempted: true,
      status: "sent",
      channel: "SMS",
      externalId: `dry-run-sms-${Date.now()}`,
      detail: "Dry-run (set MESSAGING_SMS_DRY_RUN=false for live Twilio)",
    };
  }

  const accountSid =
    process.env.MESSAGING_SMS_ACCOUNT_SID?.trim() ||
    process.env.TWILIO_ACCOUNT_SID?.trim() ||
    "";
  const authToken = process.env.MESSAGING_SMS_PROVIDER_KEY?.trim() || "";
  const from = process.env.MESSAGING_SMS_FROM?.trim() || "";

  if (!accountSid || !authToken || !from) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "SMS",
      detail: "Twilio SID / token / from incomplete",
    };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const form = new URLSearchParams({
      To: to,
      From: from,
      Body: opts.body.slice(0, 1500),
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
      error_message?: string;
    };
    if (!res.ok) {
      console.error("[messaging:sms:twilio]", res.status, data);
      return {
        attempted: true,
        status: "failed",
        channel: "SMS",
        detail:
          data.error_message || data.message || `Twilio HTTP ${res.status}`,
      };
    }
    return {
      attempted: true,
      status: "sent",
      channel: "SMS",
      externalId: data.sid,
      detail: "twilio",
    };
  } catch (e) {
    console.error("[messaging:sms:twilio]", e);
    return {
      attempted: true,
      status: "failed",
      channel: "SMS",
      detail: e instanceof Error ? e.message : "Twilio request failed",
    };
  }
}

/** Ops dashboard labels (platform product management). */
export function messagingSetupLabel() {
  const email = isEmailMessagingEnabled();
  const emailTransport = hasEmailTransport();
  const sms = isSmsMessagingEnabled();
  const smsDry = process.env.MESSAGING_SMS_DRY_RUN !== "false";
  const emailDry = process.env.MESSAGING_EMAIL_DRY_RUN === "true";

  const parts: string[] = ["In-app"];
  if (email && emailTransport) {
    parts.push(emailDry ? "Email dry-run" : "Email live");
  } else if (email) {
    parts.push("Email on (no transport)");
  } else {
    parts.push("Email off");
  }
  if (sms) {
    parts.push(smsDry ? "SMS dry-run" : "SMS live");
  } else {
    parts.push("SMS not configured");
  }
  return parts.join(" · ");
}

export function emailMessagingStatus(): {
  enabled: boolean;
  transport: "resend" | "smtp" | "none";
  from: string | null;
  dryRun: boolean;
} {
  const from = emailFromAddress();
  let transport: "resend" | "smtp" | "none" = "none";
  if (resendApiKey()) transport = "resend";
  else if (smtpConfigured()) transport = "smtp";
  return {
    enabled: isEmailMessagingEnabled(),
    transport,
    from,
    dryRun: process.env.MESSAGING_EMAIL_DRY_RUN === "true",
  };
}

export function smsMessagingStatus(): {
  enabled: boolean;
  from: string | null;
  dryRun: boolean;
  accountSidSet: boolean;
} {
  return {
    enabled: isSmsMessagingEnabled(),
    from: process.env.MESSAGING_SMS_FROM?.trim() || null,
    dryRun: process.env.MESSAGING_SMS_DRY_RUN !== "false",
    accountSidSet: Boolean(
      process.env.MESSAGING_SMS_ACCOUNT_SID?.trim() ||
      process.env.TWILIO_ACCOUNT_SID?.trim(),
    ),
  };
}
