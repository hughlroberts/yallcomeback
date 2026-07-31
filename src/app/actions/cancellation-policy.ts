"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  DEFAULT_LONG_STAY_POLICY,
  DEFAULT_SHORT_STAY_POLICY,
  isLongStayPolicyId,
  isShortStayPolicyId,
} from "@/lib/cancellation-policies";
import { ensureHostAccess, propertyScopeWhere } from "@/lib/scope";

export async function savePropertyCancellationPolicy(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  if (!propertyId) throw new Error("Missing property");

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(access) },
    select: { id: true },
  });
  if (!property) throw new Error("Property not found");

  const shortRaw = String(formData.get("cancellationPolicy") || "");
  const longRaw = String(formData.get("longTermCancellationPolicy") || "");
  const cancellationPolicy = isShortStayPolicyId(shortRaw)
    ? shortRaw
    : DEFAULT_SHORT_STAY_POLICY;
  const longTermCancellationPolicy = isLongStayPolicyId(longRaw)
    ? longRaw
    : DEFAULT_LONG_STAY_POLICY;
  const nonRefundableOption =
    formData.get("nonRefundableOption") === "on" ||
    formData.get("nonRefundableOption") === "true";

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      cancellationPolicy,
      longTermCancellationPolicy,
      nonRefundableOption,
    },
  });

  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/marketplace");
  redirect(`/admin/properties/${propertyId}?tab=cancellation&saved=policy`);
}
