"use server";

import { compare } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import {
  readUploadedImage,
  writePublicUpload,
} from "@/lib/upload-image";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

function revalidateAccount() {
  revalidatePath("/account");
  revalidatePath("/account/settings", "layout");
}

export async function updatePersonalInfo(formData: FormData) {
  const session = await requireUser();
  if (!session) redirect("/login?callbackUrl=/account/settings/personal");

  const name = String(formData.get("name") || "").trim() || null;
  const preferredName =
    String(formData.get("preferredName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const residentialAddress =
    String(formData.get("residentialAddress") || "").trim() || null;
  const mailingAddress =
    String(formData.get("mailingAddress") || "").trim() || null;
  const emergencyContact =
    String(formData.get("emergencyContact") || "").trim() || null;

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      preferredName,
      phone,
      residentialAddress,
      mailingAddress,
      emergencyContact,
    },
  });

  revalidateAccount();
  redirect("/account/settings/personal?saved=1");
}

/** Upload personal profile photo (used for “meet host” + default site mark). */
export async function uploadUserAvatar(formData: FormData) {
  const session = await requireUser();
  if (!session) redirect("/login?callbackUrl=/account/settings/personal");

  const parsed = await readUploadedImage(formData.get("file") as File | null, {
    maxBytes: 4 * 1024 * 1024,
  });
  if (!parsed.ok) {
    const code =
      parsed.error === "size"
        ? "avatar_size"
        : parsed.error === "type"
          ? "avatar_type"
          : "avatar_file";
    redirect(`/account/settings/personal?edit=1&error=${code}`);
  }

  const { publicUrl: avatarUrl } = await writePublicUpload(
    ["avatars", session.user.id],
    parsed.image,
  );
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl },
  });

  revalidateAccount();
  revalidatePath("/admin/brand");
  revalidatePath("/marketplace");
  redirect("/account/settings/personal?saved=1");
}

export async function clearUserAvatar() {
  const session = await requireUser();
  if (!session) redirect("/login?callbackUrl=/account/settings/personal");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: null },
  });

  revalidateAccount();
  redirect("/account/settings/personal?saved=1");
}

export async function updatePrivacySettings(formData: FormData) {
  const session = await requireUser();
  if (!session) redirect("/login?callbackUrl=/account/settings/privacy");

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      showReadReceipts: formData.get("showReadReceipts") === "on",
      includeListingsInSearch:
        formData.get("includeListingsInSearch") === "on",
    },
  });

  revalidateAccount();
  redirect("/account/settings/privacy?saved=1");
}

export async function updateNotificationSettings(formData: FormData) {
  const session = await requireUser();
  if (!session) {
    redirect("/login?callbackUrl=/account/settings/notifications");
  }

  const returnRaw = String(formData.get("returnTo") || "").trim();
  const allowedReturns = [
    "/messages",
    "/admin/messages",
    "/account/settings/notifications",
  ];
  const returnTo =
    returnRaw === "/admin/messages" ||
    returnRaw.startsWith("/admin/messages/")
      ? "/admin/messages"
      : allowedReturns.includes(returnRaw)
        ? returnRaw
        : "/account/settings/notifications";

  const emailOn = formData.get("emailNotifications") === "on";
  const smsOn = formData.has("smsNotifications")
    ? formData.get("smsNotifications") === "on"
    : undefined;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      emailNotifications: emailOn,
      ...(smsOn !== undefined ? { smsNotifications: smsOn } : {}),
    },
    select: { email: true, phone: true },
  });

  // Keep suppress list in sync so in-email unsubscribe and profile agree
  const { clearChannelOptOut, applyChannelOptOut } = await import(
    "@/lib/notification-prefs"
  );
  if (user.email) {
    if (emailOn) {
      await clearChannelOptOut({ channel: "email", address: user.email });
    } else {
      await applyChannelOptOut({
        channel: "email",
        address: user.email,
        source: "profile",
      });
    }
  }
  if (smsOn !== undefined && user.phone) {
    if (smsOn) {
      await clearChannelOptOut({ channel: "sms", address: user.phone });
    } else {
      await applyChannelOptOut({
        channel: "sms",
        address: user.phone,
        source: "profile",
      });
    }
  }

  revalidateAccount();
  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  revalidatePath("/account/settings/notifications");
  const q = returnTo.includes("notifications") ? "saved=1" : "prefs=1";
  redirect(`${returnTo}?${q}`);
}

export async function updateLanguageCurrency(formData: FormData) {
  const session = await requireUser();
  if (!session) redirect("/login?callbackUrl=/account/settings/language");

  const language = String(formData.get("language") || "en-US").trim();
  const currencyDisplay = String(formData.get("currencyDisplay") || "USD").trim();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      language: language || "en-US",
      currencyDisplay: currencyDisplay || "USD",
    },
  });

  revalidateAccount();
  redirect("/account/settings/language?saved=1");
}

export async function changePassword(formData: FormData) {
  const session = await requireUser();
  if (!session) redirect("/login?callbackUrl=/account/settings/login");

  const current = String(formData.get("currentPassword") || "");
  const next = String(formData.get("newPassword") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  if (next.length < 8) {
    redirect("/account/settings/login?error=short");
  }
  if (next !== confirm) {
    redirect("/account/settings/login?error=mismatch");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.passwordHash) {
    redirect("/account/settings/login?error=none");
  }

  const ok = await compare(current, user.passwordHash);
  if (!ok) {
    redirect("/account/settings/login?error=current");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  revalidateAccount();
  redirect("/account/settings/login?saved=1");
}
