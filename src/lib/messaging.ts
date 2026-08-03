/**
 * Guest ↔ host messaging delivery.
 *
 * In-app always works. Email goes to the guest/host address on each new message
 * when a transport is configured (Resend API key, or SMTP via nodemailer).
 *
 * SMS is wired for a future Twilio-style provider; enable only via ops env.
 * Do not surface SMS in guest-facing product copy — ops settings only.
 */

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
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function emailFromAddress(): string | null {
  const from =
    process.env.MESSAGING_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "";
  return from || null;
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
}): { text: string; html: string } {
  const origin = messagingSiteOrigin();
  const path =
    opts.replyPath ||
    `/messages/${opts.conversationId}`;
  const url = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const unsub = opts.unsubscribeUrl?.trim() || null;
  const prefsUrl = `${origin}/account/settings/notifications`;
  const text = [
    opts.body,
    "",
    "—",
    `Reply in your inbox: ${url}`,
    unsub ? `Stop message emails: ${unsub}` : null,
    `Notification settings: ${prefsUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1c1917">
  <div style="white-space:pre-wrap;font-size:15px">${escapeHtml(opts.body)}</div>
  <p style="margin-top:24px">
    <a href="${escapeHtml(url)}" style="color:#3a4a86;font-weight:600">Reply in your inbox →</a>
  </p>
  <p style="margin-top:28px;padding-top:16px;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c">
    You received this because someone messaged you on ${escapeHtml(
      process.env.NEXT_PUBLIC_SITE_NAME || "Yall Come Back",
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

async function sendViaResend(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  apiKey: string;
}): Promise<DispatchResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: opts.from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
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
    const createTransport =
      mod.createTransport || mod.default?.createTransport;
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
    const { canSendEmailTo, unsubscribeUrl } = await import(
      "@/lib/notification-prefs"
    );
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

  const from = emailFromAddress();
  if (!from) {
    return {
      attempted: false,
      status: "not_configured",
      channel: "EMAIL",
      detail: "MESSAGING_EMAIL_FROM missing",
    };
  }

  const { unsubscribeUrl } = await import("@/lib/notification-prefs");
  const { text, html } = buildEmailBodies({
    ...opts,
    unsubscribeUrl: unsubscribeUrl(to, "email"),
  });

  // Explicit dry-run for staging (default off when a real transport exists)
  if (process.env.MESSAGING_EMAIL_DRY_RUN === "true") {
    console.info("[messaging:email:dry-run]", {
      to,
      subject: opts.subject,
      conversationId: opts.conversationId,
      from,
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
    });
  }

  if (smtpConfigured()) {
    return sendViaSmtp({ from, to, subject: opts.subject, text, html });
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
      detail: "SMS not enabled (ops)",
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
        detail: data.error_message || data.message || `Twilio HTTP ${res.status}`,
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
