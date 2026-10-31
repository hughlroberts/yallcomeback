"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { incomingIp, rateLimitAllow } from "@/lib/rate-limit";
import { homeAfterLogin } from "@/lib/login-home";
import { normalizeNewEmail } from "@/lib/email-change";
import {
  consumeAuthToken,
  peekAuthToken,
} from "@/lib/auth-tokens";
import {
  sendPasswordResetEmail,
  sendSignupVerificationEmail,
} from "@/lib/account-email";

const GENERIC_FORGOT_PATH = "/forgot-password?sent=1";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const ip = await incomingIp();
  if (
    !rateLimitAllow(`forgot:ip:${ip}`, 8, 60 * 60 * 1000) ||
    !rateLimitAllow(`forgot:email:${email || "empty"}`, 3, 60 * 60 * 1000)
  ) {
    redirect("/forgot-password?error=rate");
  }
  if (!email) redirect(GENERIC_FORGOT_PATH);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (user?.passwordHash) {
    try {
      await sendPasswordResetEmail({
        userId: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (err) {
      console.error("[auth] password reset email failed", err);
    }
  }
  redirect(GENERIC_FORGOT_PATH);
}

export async function resetPasswordWithForm(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const ip = await incomingIp();
  if (!rateLimitAllow(`reset:ip:${ip}`, 20, 15 * 60 * 1000)) {
    redirect("/reset-password?error=rate");
  }
  if (!token) redirect("/reset-password?error=invalid");
  if (password.length < 8) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=short`,
    );
  }
  if (password !== confirm) {
    redirect(
      `/reset-password?token=${encodeURIComponent(token)}&error=mismatch`,
    );
  }

  const peeked = await peekAuthToken(token, "PASSWORD_RESET");
  if (!peeked) redirect("/reset-password?error=invalid");

  const passwordHash = await hashPassword(password);
  const consumed = await consumeAuthToken(token, "PASSWORD_RESET");
  if (!consumed) redirect("/reset-password?error=invalid");

  await prisma.user.update({
    where: { id: consumed.userId },
    data: { passwordHash },
  });

  const dest = homeAfterLogin(consumed.role);
  await signIn("credentials", {
    email: consumed.email,
    password,
    redirectTo: dest,
  });
}

export async function resendVerificationEmail(): Promise<{
  ok?: true;
  already?: true;
  error?: string;
  message?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to resend the confirmation email." };
  }
  const ip = await incomingIp();
  if (
    !rateLimitAllow(`verify-resend:ip:${ip}`, 5, 60 * 60 * 1000) ||
    !rateLimitAllow(`verify-resend:user:${session.user.id}`, 3, 60 * 60 * 1000)
  ) {
    return { error: "Too many resend attempts. Wait a few minutes." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) return { error: "Account not found." };
  if (user.emailVerifiedAt) {
    return {
      ok: true,
      already: true,
      message: "This email is already confirmed.",
    };
  }

  try {
    await sendSignupVerificationEmail({
      userId: user.id,
      email: user.email,
      name: user.name,
      kind: user.role === "HOST" || user.role === "ADMIN" ? "host" : "guest",
    });
  } catch (err) {
    console.error("[auth] resend verify email failed", err);
    return { error: "Could not send the email. Try again in a few minutes." };
  }
  return {
    ok: true,
    message: "Check your inbox for a new confirmation link.",
  };
}

/**
 * Change the signed-in user's email (unverified or re-verify), then send a
 * fresh confirmation link. Rejects addresses already used by another account.
 */
export async function updateAccountEmailAndResend(newEmailRaw: string): Promise<{
  ok?: true;
  error?: string;
  message?: string;
  email?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sign in to update your email." };
  }
  const ip = await incomingIp();
  if (
    !rateLimitAllow(`verify-email-change:ip:${ip}`, 5, 60 * 60 * 1000) ||
    !rateLimitAllow(
      `verify-email-change:user:${session.user.id}`,
      3,
      60 * 60 * 1000,
    )
  ) {
    return { error: "Too many attempts. Wait a few minutes." };
  }

  const parsed = normalizeNewEmail(newEmailRaw);
  if ("error" in parsed) return { error: parsed.error };
  const email = parsed.email;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
    },
  });
  if (!user) return { error: "Account not found." };

  if (email === user.email) {
    if (user.emailVerifiedAt) {
      return {
        ok: true,
        email,
        message: "This email is already confirmed.",
      };
    }
    try {
      await sendSignupVerificationEmail({
        userId: user.id,
        email: user.email,
        name: user.name,
        kind: user.role === "HOST" || user.role === "ADMIN" ? "host" : "guest",
      });
    } catch (err) {
      console.error("[auth] resend verify email failed", err);
      return { error: "Could not send the email. Try again in a few minutes." };
    }
    return {
      ok: true,
      email,
      message: "Check your inbox for a new confirmation link.",
    };
  }

  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken) {
    return { error: "That email is already used by another account." };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        emailVerifiedAt: null,
      },
    });
  } catch (err) {
    // Unique index race: someone took the address between check and write.
    if ((err as { code?: string })?.code === "P2002") {
      return { error: "That email is already used by another account." };
    }
    throw err;
  }
  revalidatePath("/account/settings", "layout");

  try {
    await sendSignupVerificationEmail({
      userId: user.id,
      email,
      name: user.name,
      kind: user.role === "HOST" || user.role === "ADMIN" ? "host" : "guest",
    });
  } catch (err) {
    console.error("[auth] change-email verify send failed", err);
    return {
      error:
        "Email was updated, but the confirmation could not be sent. Try resend in a few minutes.",
      email,
    };
  }

  return {
    ok: true,
    email,
    message: "Email updated. Check your inbox for a new confirmation link.",
  };
}
