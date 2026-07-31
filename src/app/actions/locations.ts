"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import {
  assertLocationAccess,
  ensureHostAccess,
  resolveHostIdForCreate,
} from "@/lib/scope";

export async function createLocation(formData: FormData) {
  const access = await ensureHostAccess();
  const hostId = await resolveHostIdForCreate(access, formData);
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");
  let slug = slugify(name);
  const existing = await prisma.location.findFirst({
    where: { hostId, slug },
  });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const location = await prisma.location.create({
    data: {
      hostId,
      name,
      slug,
      description: String(formData.get("description") || "") || null,
      region: String(formData.get("region") || "") || null,
      country: String(formData.get("country") || "") || null,
      published: true,
    },
  });

  revalidatePath("/admin/locations");
  revalidatePath("/locations");
  revalidatePath("/marketplace");
  redirect(`/admin/locations/${location.id}`);
}

export async function updateLocation(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertLocationAccess(id, access);
  await prisma.location.update({
    where: { id },
    data: {
      name: String(formData.get("name") || "").trim(),
      description: String(formData.get("description") || "") || null,
      region: String(formData.get("region") || "") || null,
      country: String(formData.get("country") || "") || null,
      published: formData.get("published") === "on",
    },
  });
  revalidatePath("/admin/locations");
  revalidatePath(`/admin/locations/${id}`);
  revalidatePath("/locations");
  revalidatePath("/marketplace");
}

export async function createThingToDo(formData: FormData) {
  const access = await ensureHostAccess();
  const locationId = String(formData.get("locationId") || "");
  await assertLocationAccess(locationId, access);
  const title = String(formData.get("title") || "").trim();
  const slug = slugify(title) || `item-${Date.now()}`;

  await prisma.thingToDo.create({
    data: {
      locationId,
      title,
      slug,
      description: String(formData.get("description") || "") || null,
      category: String(formData.get("category") || "") || null,
      websiteUrl: String(formData.get("websiteUrl") || "") || null,
      published: true,
    },
  });

  revalidatePath(`/admin/locations/${locationId}`);
  revalidatePath("/locations");
  revalidatePath("/marketplace");
}

export async function deleteThingToDo(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const locationId = String(formData.get("locationId") || "");
  await assertLocationAccess(locationId, access);
  await prisma.thingToDo.delete({ where: { id } });
  revalidatePath(`/admin/locations/${locationId}`);
}
