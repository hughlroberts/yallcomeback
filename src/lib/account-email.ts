import { PRODUCT_NAME } from "@/lib/features";
import {
  dispatchPlatformEmail,
  messagingSiteOrigin,
} from "@/lib/messaging";
import {
  EMAIL_VERIFY_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  issueAuthToken,
} from "@/lib/auth-tokens";
import { prisma } from "@/lib/db";

function firstName(name: string | null | undefined): string {
  const t = (name || "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0] || "";
}

function greeting(name: string | null | undefined): string {
  const first = firstName(name);
  return first ? `Hi ${first},` : "Hi,";
}

export async function sendSignupVerificationEmail(opts: {
  userId: string;
  email: string;
  name?: string | null;
  kind: "host" | "guest";
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { emailVerifiedAt: true, name: true, email: true },
  });
  if (!user) return;

  const origin = messagingSiteOrigin();
  const who = greeting(opts.name ?? user.name);

  if (user.emailVerifiedAt) {
    const hostExtra =
      opts.kind === "host"
        ? [
            "Your host account is ready. Add a listing when you are, then turn bookings on when you want guests to find you.",
            "",
          ]
        : [];
    await dispatchPlatformEmail({
      to: opts.email,
      subject: `Thanks for signing up — ${PRODUCT_NAME}`,
      text: [
        who,
        "",
        `Thanks for signing up with ${PRODUCT_NAME}.`,
        "",
        ...hostExtra,
        `Open ${origin} any time.`,
        "",
        PRODUCT_NAME,
      ].join("\n"),
    });
    return;
  }

  const raw = await issueAuthToken({
    userId: opts.userId,
    kind: "EMAIL_VERIFY",
    ttlMs: EMAIL_VERIFY_TTL_MS,
  });
  const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(raw)}`;

  const hostBits =
    opts.kind === "host"
      ? [
          "Thanks for signing up as a host. We are glad you are here.",
          "",
          "Confirm this email before you publish a listing. You can still set up drafts, calendars, and photos in the meantime.",
        ]
      : [
          `Thanks for signing up with ${PRODUCT_NAME}.`,
          "",
          "Confirm this email so we know it is you.",
        ];

  await dispatchPlatformEmail({
    to: opts.email,
    subject:
      opts.kind === "host"
        ? `Thanks for signing up — confirm your email to publish a listing`
        : `Thanks for signing up — confirm your email`,
    text: [
      who,
      "",
      ...hostBits,
      "",
      `Confirm your email: ${verifyUrl}`,
      "",
      "This link expires in 48 hours. If you did not create this account, you can ignore this message.",
      "",
      PRODUCT_NAME,
    ].join("\n"),
  });
}

export async function sendPasswordResetEmail(opts: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<void> {
  const raw = await issueAuthToken({
    userId: opts.userId,
    kind: "PASSWORD_RESET",
    ttlMs: PASSWORD_RESET_TTL_MS,
  });
  const origin = messagingSiteOrigin();
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(raw)}`;
  await dispatchPlatformEmail({
    to: opts.email,
    subject: `Reset your ${PRODUCT_NAME} password`,
    text: [
      greeting(opts.name),
      "",
      `We received a request to reset the password for this ${PRODUCT_NAME} account.`,
      "",
      `Set a new password: ${resetUrl}`,
      "",
      "This link expires in 1 hour. If you did not ask for a reset, you can ignore this message. Your password stays the same.",
      "",
      PRODUCT_NAME,
    ].join("\n"),
  });
}
