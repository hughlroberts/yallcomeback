"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { HostAccessLevel } from "@prisma/client";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageTeam, resolveHostAccessInfo } from "@/lib/host-access";

function parseAccess(raw: string): HostAccessLevel | null {
  if (raw === "FULL" || raw === "LIMITED") return raw;
  return null;
}

/** Owner (or platform) invites a co-host on the active brand. */
export async function inviteCoHost(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) throw new Error("Unauthorized");

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageTeam(info)) {
    redirect("/admin/team?error=forbidden");
  }

  const hostId = access.hostId;
  if (!hostId) redirect("/admin/team?error=brand");

  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") || "").trim() || "Co-host";
  const password = String(formData.get("password") || "");
  const level = parseAccess(String(formData.get("hostAccess") || "LIMITED"));

  if (!email.includes("@")) redirect("/admin/team?error=email");
  if (password.length < 8) redirect("/admin/team?error=password");
  if (!level) redirect("/admin/team?error=access");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.role === "ADMIN") {
    redirect("/admin/team?error=admin");
  }
  if (existing?.hostId && existing.hostId !== hostId) {
    redirect("/admin/team?error=other_brand");
  }

  const passwordHash = await hash(password, 10);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: name || existing.name,
        role: "HOST",
        hostId,
        hostAccess: level,
        passwordHash,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        name,
        role: "HOST",
        hostId,
        hostAccess: level,
        passwordHash,
      },
    });
  }

  revalidatePath("/admin/team");
  redirect("/admin/team?saved=1");
}

export async function updateCoHostAccess(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) throw new Error("Unauthorized");

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageTeam(info)) redirect("/admin/team?error=forbidden");

  const hostId = access.hostId;
  if (!hostId) redirect("/admin/team?error=brand");

  const id = String(formData.get("id") || "");
  const level = parseAccess(String(formData.get("hostAccess") || ""));
  if (!id || !level) redirect("/admin/team?error=missing");

  const user = await prisma.user.findFirst({
    where: { id, hostId, role: "HOST" },
  });
  if (!user) redirect("/admin/team?error=missing");
  if (user.hostAccess === "OWNER") {
    redirect("/admin/team?error=owner");
  }
  if (id === access.session.user.id) {
    redirect("/admin/team?error=self");
  }

  await prisma.user.update({
    where: { id },
    data: { hostAccess: level },
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?saved=1");
}

export async function removeCoHost(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) throw new Error("Unauthorized");

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageTeam(info)) redirect("/admin/team?error=forbidden");

  const hostId = access.hostId;
  if (!hostId) redirect("/admin/team?error=brand");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/admin/team?error=missing");
  if (id === access.session.user.id) {
    redirect("/admin/team?error=self");
  }

  const user = await prisma.user.findFirst({
    where: { id, hostId, role: "HOST" },
  });
  if (!user) redirect("/admin/team?error=missing");
  if (user.hostAccess === "OWNER") {
    redirect("/admin/team?error=owner");
  }

  // Demote to guest, detach from brand
  await prisma.user.update({
    where: { id },
    data: {
      role: "GUEST",
      hostId: null,
      hostAccess: null,
    },
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?saved=removed");
}

/** Host owner resets a co-host password (temp password). */
export async function resetCoHostPassword(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) throw new Error("Unauthorized");

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageTeam(info)) redirect("/admin/team?error=forbidden");

  const hostId = access.hostId;
  if (!hostId) redirect("/admin/team?error=brand");

  const id = String(formData.get("id") || "");
  const password = String(formData.get("password") || "");
  if (!id || password.length < 8) redirect("/admin/team?error=password");

  const user = await prisma.user.findFirst({
    where: { id, hostId, role: "HOST" },
  });
  if (!user) redirect("/admin/team?error=missing");

  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hash(password, 10) },
  });

  revalidatePath("/admin/team");
  redirect("/admin/team?saved=reset");
}
