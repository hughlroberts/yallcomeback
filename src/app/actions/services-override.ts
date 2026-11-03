"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";

/**
 * Platform admin only: let a brand (test or internal) use the Services page
 * without the Branded website plan. Changes servicesOverride (and turns the
 * page on when enabling) only. No plan, subscription or Stripe change.
 */
export async function setServicesOverride(formData: FormData): Promise<void> {
  const session = await requirePlatformAdmin();
  // isPlatform check: requirePlatformAdmin reads the role from the database.
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Only a platform admin can change this.");
  }
  const hostId = String(formData.get("hostId") || "").trim();
  if (!hostId) throw new Error("Missing brand.");
  const enabled = formData.get("servicesOverride") === "on";

  const existing = await prisma.host.findUnique({
    where: { id: hostId },
    select: { id: true, slug: true, siteServicesBlocks: true, siteServicesTitle: true, siteServicesPath: true },
  });
  if (!existing) throw new Error("Brand not found.");

  let seed: { siteServicesBlocks?: string; siteServicesTitle?: string; siteServicesPath?: string } = {};
  if (enabled && !existing.siteServicesBlocks?.trim().replace(/^\[\]$/, "")) {
    const { boatRentalsStarterBlocks } = await import("@/lib/services-blocks");
    seed = {
      siteServicesBlocks: JSON.stringify(boatRentalsStarterBlocks()),
      ...(existing.siteServicesTitle ? {} : { siteServicesTitle: "Boat rentals & lake extras" }),
      ...(existing.siteServicesPath ? {} : { siteServicesPath: "boat-rentals" }),
    };
  }

  await prisma.host.update({
    where: { id: hostId },
    data: enabled
      ? { servicesOverride: true, sitePageServices: true, ...seed }
      : { servicesOverride: false },
  });

  revalidatePath(`/ops/hosting/${hostId}`);
  revalidatePath("/admin/brand");
  revalidatePath(`/h/${existing.slug}`);
}
