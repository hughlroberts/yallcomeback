/**
 * Guest ↔ host messaging.
 *
 * Default: in-app only (works on self-host and platform).
 * SMS / email: hooks for the hosted portal - wired when env is set.
 * Local / open-source deploys keep the same API but skip external delivery
 * unless the operator configures a provider.
 */

export type ExternalMessageChannel = "SMS" | "EMAIL";

export type DispatchResult = {
  attempted: boolean;
  status: "sent" | "skipped" | "failed" | "not_configured";
  externalId?: string;
  detail?: string;
};

/** Platform-hosted SMS (Twilio-style) - not on by default for self-host */
export function isSmsMessagingEnabled(): boolean {
  return (
    process.env.MESSAGING_SMS_ENABLED === "true" &&
    Boolean(process.env.MESSAGING_SMS_FROM) &&
    Boolean(process.env.MESSAGING_SMS_PROVIDER_KEY)
  );
}

/** Optional email notify hook (hosted or self-configured) */
export function isEmailMessagingEnabled(): boolean {
  return (
    process.env.MESSAGING_EMAIL_ENABLED === "true" &&
    Boolean(process.env.MESSAGING_EMAIL_FROM)
  );
}

/**
 * Hook for SMS delivery. No-op when not configured (local / open-source default).
 * Replace body with real Twilio (or similar) call on the hosted portal.
 */
export async function dispatchSms(opts: {
  to: string;
  body: string;
  conversationId: string;
}): Promise<DispatchResult> {
  if (!isSmsMessagingEnabled()) {
    return {
      attempted: false,
      status: "not_configured",
      detail:
        "SMS hook present but disabled. Set MESSAGING_SMS_ENABLED=true and provider keys on hosted portal.",
    };
  }

  // Hosted portal: integrate provider here (Twilio, etc.)
  // For now log-only so local deploys never send real SMS by accident.
  if (process.env.MESSAGING_SMS_DRY_RUN !== "false") {
    console.info("[messaging:sms:dry-run]", {
      to: opts.to,
      conversationId: opts.conversationId,
      preview: opts.body.slice(0, 80),
    });
    return {
      attempted: true,
      status: "sent",
      externalId: `dry-run-sms-${Date.now()}`,
      detail: "Dry-run SMS (set MESSAGING_SMS_DRY_RUN=false to send live)",
    };
  }

  return {
    attempted: false,
    status: "not_configured",
    detail: "Live SMS provider adapter not yet connected",
  };
}

export async function dispatchEmail(opts: {
  to: string;
  subject: string;
  body: string;
  conversationId: string;
}): Promise<DispatchResult> {
  if (!isEmailMessagingEnabled()) {
    return {
      attempted: false,
      status: "not_configured",
      detail: "Email messaging disabled (in-app only)",
    };
  }

  if (process.env.MESSAGING_EMAIL_DRY_RUN !== "false") {
    console.info("[messaging:email:dry-run]", {
      to: opts.to,
      subject: opts.subject,
      conversationId: opts.conversationId,
    });
    return {
      attempted: true,
      status: "sent",
      externalId: `dry-run-email-${Date.now()}`,
    };
  }

  return {
    attempted: false,
    status: "not_configured",
    detail: "Live email provider adapter not yet connected",
  };
}

export function messagingSetupLabel() {
  const sms = isSmsMessagingEnabled();
  const email = isEmailMessagingEnabled();
  if (!sms && !email) {
    return "In-app only (SMS/email hooks for hosted portal)";
  }
  return [
    "In-app",
    sms ? "SMS hook on" : null,
    email ? "Email hook on" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
