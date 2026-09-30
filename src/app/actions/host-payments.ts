"use server";

import { revalidatePath } from "next/cache";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import { parsePaymentMethod } from "@/lib/host-payments";
import { assertPropertyAccess } from "@/lib/scope";

export async function saveListingPaymentMethod(formData: FormData) {
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

  const id = String(formData.get("id") || formData.get("propertyId") || "");
  if (!id) throw new Error("Listing is required.");
  await assertPropertyAccess(id, access);

  const websitePaymentMethod = parsePaymentMethod(
    formData.get("websitePaymentMethod"),
  );

  const property = await prisma.property.update({
    where: { id },
    data: { websitePaymentMethod },
    select: { id: true, host: { select: { slug: true } } },
  });
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${property.id}`);
  revalidatePath(`/h/${property.host.slug}`);
}
