"use server";

import { hash, compare } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
  if (!session) redirect("/login?callbackUrl=/messages");

  const returnRaw = String(formData.get("returnTo") || "/messages").trim();
  const returnTo =
    returnRaw === "/admin/messages" || returnRaw.startsWith("/admin/messages/")
      ? "/admin/messages"
      : "/messages";

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      emailNotifications: formData.get("emailNotifications") === "on",
      smsNotifications: formData.get("smsNotifications") === "on",
    },
  });

  revalidateAccount();
  revalidatePath("/messages");
  revalidatePath("/admin/messages");
  redirect(`${returnTo}?prefs=1`);
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
    data: { passwordHash: await hash(next, 10) },
  });

  revalidateAccount();
  redirect("/account/settings/login?saved=1");
}
