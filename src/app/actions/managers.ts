"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Add another platform manager (role ADMIN). Hosts and guests are separate roles.
 */
export async function addPlatformManager(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) throw new Error("Unauthorized");

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim() || "Platform manager";
  const password = String(formData.get("password") || "");

  if (!email.includes("@")) {
    redirect("/ops/managers?error=email");
  }
  if (password.length < 8) {
    redirect("/ops/managers?error=password");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role === "ADMIN") {
    redirect("/ops/managers?error=exists");
  }

  const passwordHash = await hash(password, 10);

  if (existing) {
    // Promote existing guest/host to platform admin carefully
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        name: name || existing.name,
        passwordHash,
        hostId: null,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "ADMIN",
      },
    });
  }

  revalidatePath("/ops/managers");
  redirect("/ops/managers?saved=1");
}

/** Demote platform admin to guest (cannot demote yourself). */
export async function removePlatformManager(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  if (!id || id === session.user.id) {
    redirect("/ops/managers?error=self");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "ADMIN") {
    redirect("/ops/managers?error=missing");
  }

  await prisma.user.update({
    where: { id },
    data: { role: "GUEST", hostId: null },
  });

  revalidatePath("/ops/managers");
  redirect("/ops/managers?saved=1");
}
