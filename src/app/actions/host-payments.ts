"use server";

import { revalidatePath } from "next/cache";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";

export async function saveHostPaymentMethods(formData: FormData) {
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

  let acceptCash = formData.get("acceptCash") === "on";
  const acceptInPersonCard = formData.get("acceptInPersonCard") === "on";
  const acceptBitcoin = formData.get("acceptBitcoin") === "on";
  const acceptOnlineCard = formData.get("acceptOnlineCard") === "on";
  if (!acceptCash && !acceptInPersonCard && !acceptBitcoin && !acceptOnlineCard) {
    acceptCash = true;
  }

  await prisma.host.update({
    where: { id: access.hostId },
    data: {
      acceptCash,
      acceptInPersonCard,
      acceptBitcoin,
      acceptOnlineCard,
    },
  });
  revalidatePath("/admin/payments");
}
