"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";

const PATH = "/ops/pricing-comps";

export async function setPricingMarketCompActive(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/pricing-comps");

  const id = String(formData.get("id") || "");
  const active = String(formData.get("active") || "") === "1";
  if (!id) redirect(`${PATH}?error=missing`);

  await prisma.pricingMarketComp.update({
    where: { id },
    data: { active },
  });
  revalidatePath(PATH);
  revalidatePath("/admin/pricing");
  redirect(PATH);
}

export async function upsertPricingMarketComp(formData: FormData) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/pricing-comps");

  const key = String(formData.get("key") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-|-$/g, "");
  const title = String(formData.get("title") || "").trim();
  const maxGuests = Math.max(
    1,
    Math.min(40, Number(formData.get("maxGuests") || 1)),
  );
  const bedrooms = Math.max(
    0,
    Math.min(20, Number(formData.get("bedrooms") || 1)),
  );
  const baseNightlyRate = Number(formData.get("baseNightlyRate") || 0);
  const city = String(formData.get("city") || "").trim() || null;
  const region = String(formData.get("region") || "").trim() || null;
  const description =
    String(formData.get("description") || "").trim() || null;
  const amenitiesRaw = String(formData.get("amenities") || "").trim();
  const amenityIds = amenitiesRaw
    ? amenitiesRaw
        .split(/[,]+/)
        .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
        .filter(Boolean)
    : [];

  if (!key || !title || !(baseNightlyRate > 0)) {
    redirect(
      `${PATH}?error=${encodeURIComponent("Key, title, and nightly rate are required.")}`,
    );
  }

  await prisma.pricingMarketComp.upsert({
    where: { key },
    create: {
      key,
      title,
      description,
      city,
      region,
      maxGuests,
      bedrooms,
      baseNightlyRate,
      amenitiesJson: JSON.stringify(amenityIds),
      active: true,
      sourceNote: "Ops manual entry — private pricing proxy",
    },
    update: {
      title,
      description,
      city,
      region,
      maxGuests,
      bedrooms,
      baseNightlyRate,
      amenitiesJson: JSON.stringify(amenityIds),
      active: true,
    },
  });

  revalidatePath(PATH);
  revalidatePath("/admin/pricing");
  redirect(`${PATH}?saved=1`);
}
