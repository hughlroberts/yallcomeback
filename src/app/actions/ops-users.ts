"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HostAccessLevel, Role } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function parseRole(raw: string): Role | null {
  if (raw === "ADMIN" || raw === "HOST" || raw === "GUEST") return raw;
  return null;
}

function parseHostAccess(raw: string): HostAccessLevel | null {
  if (raw === "OWNER" || raw === "FULL" || raw === "LIMITED") return raw;
  return null;
}

/** Create or update a user (platform ops). */
export async function opsUpsertUser(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) throw new Error("Unauthorized");

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim() || null;
  const role = parseRole(String(formData.get("role") || "GUEST"));
  const hostIdRaw = String(formData.get("hostId") || "").trim();
  const hostAccess = parseHostAccess(String(formData.get("hostAccess") || ""));
  const password = String(formData.get("password") || "");

  if (!email.includes("@") || !role) {
    redirect("/ops/users?error=email");
  }
  if (password && password.length < 8) {
    redirect("/ops/users?error=password");
  }

  let hostId: string | null = null;
  let access: HostAccessLevel | null = null;
  if (role === "HOST") {
    if (!hostIdRaw) redirect("/ops/users?error=host");
    const host = await prisma.host.findUnique({ where: { id: hostIdRaw } });
    if (!host) redirect("/ops/users?error=host");
    hostId = host.id;
    access = hostAccess || "FULL";
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = password ? await hash(password, 10) : undefined;

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: name ?? existing.name,
        role,
        hostId,
        hostAccess: role === "HOST" ? access : null,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  } else {
    if (!passwordHash) redirect("/ops/users?error=password");
    await prisma.user.create({
      data: {
        email,
        name,
        role,
        hostId,
        hostAccess: role === "HOST" ? access : null,
        passwordHash,
      },
    });
  }

  revalidatePath("/ops/users");
  redirect("/ops/users?saved=1");
}

export async function opsResetUserPassword(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  if (!id || password.length < 8) {
    redirect("/ops/users?error=password");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) redirect("/ops/users?error=missing");

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hash(password, 10) },
  });

  revalidatePath("/ops/users");
  redirect("/ops/users?saved=reset");
}

export async function opsUpdateUserRole(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) throw new Error("Unauthorized");

  const id = String(formData.get("id") || "");
  const role = parseRole(String(formData.get("role") || ""));
  const hostIdRaw = String(formData.get("hostId") || "").trim();
  const hostAccess = parseHostAccess(String(formData.get("hostAccess") || ""));

  if (!id || !role) redirect("/ops/users?error=missing");
  if (id === session.user.id && role !== "ADMIN") {
    redirect("/ops/users?error=self");
  }

  let hostId: string | null = null;
  let access: HostAccessLevel | null = null;
  if (role === "HOST") {
    if (!hostIdRaw) redirect("/ops/users?error=host");
    hostId = hostIdRaw;
    access = hostAccess || "FULL";
  }

  await prisma.user.update({
    where: { id },
    data: {
      role,
      hostId,
      hostAccess: role === "HOST" ? access : null,
    },
  });

  revalidatePath("/ops/users");
  redirect("/ops/users?saved=1");
}
