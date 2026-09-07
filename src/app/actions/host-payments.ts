"use server";

import type { PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";

const ALLOWED: PaymentMethod[] = [
  "STRIPE",
  "MANUAL",
  "BITCOIN",
  "IN_PERSON_CARD",
];

export async function saveWebsitePaymentMethod(formData: FormData) {
  const access = await requireHostAdmin();
  if (!access?.hostId) throw new Error("Pick a host brand first.");
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(info) && !access.isPlatform) {
    throw new Error("You cannot change payment methods for this brand.");
  }

  const raw = String(formData.get("websitePaymentMethod") || "STRIPE");
  const websitePaymentMethod = (ALLOWED.includes(raw as PaymentMethod)
    ? raw
    : "STRIPE") as PaymentMethod;

  await prisma.host.update({
    where: { id: access.hostId },
    data: { websitePaymentMethod },
  });
  revalidatePath("/admin/payments");
}
