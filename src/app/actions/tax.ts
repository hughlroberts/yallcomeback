"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";

function revalidateTax(hostId: string) {
  revalidatePath("/help/taxes");
  revalidatePath("/account/settings/taxes");
  revalidatePath("/admin");
  revalidatePath("/marketplace");
  void hostId;
}

async function resolveHostId(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access) return null;

  const hostId = String(formData.get("hostId") || access.hostId || "");
  if (!hostId) return null;
  if (!access.isPlatform && access.hostId !== hostId) return null;
  return { access, hostId };
}

export async function acknowledgeTaxLiability(formData: FormData) {
  const resolved = await resolveHostId(formData);
  if (!resolved) redirect("/login?callbackUrl=/help/taxes");

  const accepted = formData.get("acceptTaxLiability") === "on";
  if (!accepted) {
    redirect("/help/taxes?error=ack");
  }

  await prisma.host.update({
    where: { id: resolved.hostId },
    data: {
      taxLiabilityAcknowledged: true,
      taxLiabilityAcknowledgedAt: new Date(),
    },
  });

  revalidateTax(resolved.hostId);
  redirect("/help/taxes?saved=ack");
}

export async function revokeTaxLiability(formData: FormData) {
  const resolved = await resolveHostId(formData);
  if (!resolved) redirect("/login?callbackUrl=/help/taxes");

  await prisma.$transaction([
    prisma.host.update({
      where: { id: resolved.hostId },
      data: {
        taxLiabilityAcknowledged: false,
        taxLiabilityAcknowledgedAt: null,
      },
    }),
    // Deactivate lines so guests stop seeing tax until re-ack + re-enable
    prisma.hostTaxLine.updateMany({
      where: { hostId: resolved.hostId },
      data: { active: false },
    }),
  ]);

  revalidateTax(resolved.hostId);
  redirect("/help/taxes?saved=revoked");
}

export async function createTaxLine(formData: FormData) {
  const resolved = await resolveHostId(formData);
  if (!resolved) redirect("/login?callbackUrl=/help/taxes");

  const host = await prisma.host.findUnique({
    where: { id: resolved.hostId },
  });
  if (!host?.taxLiabilityAcknowledged) {
    redirect("/help/taxes?error=ack_required");
  }

  const name = String(formData.get("name") || "").trim();
  const ratePercent = Number(formData.get("ratePercent") || 0);
  if (!name || !Number.isFinite(ratePercent) || ratePercent <= 0 || ratePercent > 100) {
    redirect("/help/taxes?error=invalid");
  }

  const maxSort = await prisma.hostTaxLine.aggregate({
    where: { hostId: resolved.hostId },
    _max: { sortOrder: true },
  });

  await prisma.hostTaxLine.create({
    data: {
      hostId: resolved.hostId,
      name,
      ratePercent: Math.round(ratePercent * 1000) / 1000,
      applyToLodging: formData.get("applyToLodging") === "on",
      applyToCleaning: formData.get("applyToCleaning") === "on",
      applyToPetFee: formData.get("applyToPetFee") === "on",
      active: formData.get("active") === "on",
      registrationId:
        String(formData.get("registrationId") || "").trim() || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  revalidateTax(resolved.hostId);
  redirect("/help/taxes?saved=1");
}

export async function updateTaxLine(formData: FormData) {
  const resolved = await resolveHostId(formData);
  if (!resolved) redirect("/login?callbackUrl=/help/taxes");

  const id = String(formData.get("id") || "");
  const line = await prisma.hostTaxLine.findFirst({
    where: { id, hostId: resolved.hostId },
  });
  if (!line) redirect("/help/taxes?error=missing");

  const name = String(formData.get("name") || "").trim();
  const ratePercent = Number(formData.get("ratePercent") || 0);
  if (!name || !Number.isFinite(ratePercent) || ratePercent <= 0 || ratePercent > 100) {
    redirect("/help/taxes?error=invalid");
  }

  await prisma.hostTaxLine.update({
    where: { id },
    data: {
      name,
      ratePercent: Math.round(ratePercent * 1000) / 1000,
      applyToLodging: formData.get("applyToLodging") === "on",
      applyToCleaning: formData.get("applyToCleaning") === "on",
      applyToPetFee: formData.get("applyToPetFee") === "on",
      active: formData.get("active") === "on",
      registrationId:
        String(formData.get("registrationId") || "").trim() || null,
    },
  });

  revalidateTax(resolved.hostId);
  redirect("/help/taxes?saved=1");
}

export async function deleteTaxLine(formData: FormData) {
  const resolved = await resolveHostId(formData);
  if (!resolved) redirect("/login?callbackUrl=/help/taxes");

  const id = String(formData.get("id") || "");
  await prisma.hostTaxLine.deleteMany({
    where: { id, hostId: resolved.hostId },
  });

  revalidateTax(resolved.hostId);
  redirect("/help/taxes?saved=deleted");
}
