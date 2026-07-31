"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DAY_BEFORE_HOURS,
  DEFAULT_WEEK_BEFORE_HOURS,
  STARTER_TEMPLATES,
} from "@/lib/booking-messages";
import { ensureHostAccess, propertyScopeWhere } from "@/lib/scope";

function parseEnabled(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function parseBody(formData: FormData, key: string) {
  const v = String(formData.get(key) || "").trim();
  return v || null;
}

function parseDaysToHours(
  formData: FormData,
  key: string,
  fallbackDays: number,
  minDays: number,
  maxDays: number,
) {
  const n = Number(formData.get(key) || fallbackDays);
  if (!Number.isFinite(n)) return fallbackDays * 24;
  const days = Math.max(minDays, Math.min(maxDays, Math.round(n)));
  return days * 24;
}

async function resolveHostIdForAccess(
  access: NonNullable<Awaited<ReturnType<typeof ensureHostAccess>>>,
  formHostId?: string,
): Promise<string> {
  if (access.isPlatform) {
    const hostId = formHostId || access.hostId;
    if (!hostId) throw new Error("Select a host");
    return hostId;
  }
  if (!access.hostId) throw new Error("No host account");
  return access.hostId;
}

/**
 * Host-level defaults + schedule (applies to all listings unless a listing sets its own body).
 */
export async function saveHostBookingMessageDefaults(formData: FormData) {
  const access = await ensureHostAccess();
  const hostId = await resolveHostIdForAccess(
    access,
    String(formData.get("hostId") || "") || undefined,
  );

  const weekHours = parseDaysToHours(
    formData,
    "autoMsgWeekBeforeDays",
    DEFAULT_WEEK_BEFORE_HOURS / 24,
    2,
    21,
  );
  const dayHours = parseDaysToHours(
    formData,
    "autoMsgDayBeforeDays",
    DEFAULT_DAY_BEFORE_HOURS / 24,
    1,
    Math.max(1, Math.floor(weekHours / 24) - 1),
  );

  const data = {
    defaultAutoMsgOnBookingEnabled: parseEnabled(
      formData,
      "defaultAutoMsgOnBookingEnabled",
    ),
    defaultAutoMsgOnBookingBody: parseBody(
      formData,
      "defaultAutoMsgOnBookingBody",
    ),
    defaultAutoMsgWeekBeforeEnabled: parseEnabled(
      formData,
      "defaultAutoMsgWeekBeforeEnabled",
    ),
    defaultAutoMsgWeekBeforeBody: parseBody(
      formData,
      "defaultAutoMsgWeekBeforeBody",
    ),
    defaultAutoMsgDayBeforeEnabled: parseEnabled(
      formData,
      "defaultAutoMsgDayBeforeEnabled",
    ),
    defaultAutoMsgDayBeforeBody: parseBody(
      formData,
      "defaultAutoMsgDayBeforeBody",
    ),
    autoMsgWeekBeforeHours: weekHours,
    autoMsgDayBeforeHours: dayHours,
  };

  if (data.defaultAutoMsgOnBookingEnabled && !data.defaultAutoMsgOnBookingBody) {
    redirect(`/admin/guest-messages?error=on_booking_body`);
  }
  if (
    data.defaultAutoMsgWeekBeforeEnabled &&
    !data.defaultAutoMsgWeekBeforeBody
  ) {
    redirect(`/admin/guest-messages?error=week_before_body`);
  }
  if (
    data.defaultAutoMsgDayBeforeEnabled &&
    !data.defaultAutoMsgDayBeforeBody
  ) {
    redirect(`/admin/guest-messages?error=day_before_body`);
  }

  await prisma.host.update({ where: { id: hostId }, data });

  const applyToListings = formData.get("applyToAllListings") === "on";
  if (applyToListings) {
    await prisma.property.updateMany({
      where: { hostId },
      data: {
        autoMsgOnBookingEnabled: data.defaultAutoMsgOnBookingEnabled,
        autoMsgOnBookingBody: data.defaultAutoMsgOnBookingBody,
        autoMsgWeekBeforeEnabled: data.defaultAutoMsgWeekBeforeEnabled,
        autoMsgWeekBeforeBody: data.defaultAutoMsgWeekBeforeBody,
        autoMsgDayBeforeEnabled: data.defaultAutoMsgDayBeforeEnabled,
        autoMsgDayBeforeBody: data.defaultAutoMsgDayBeforeBody,
      },
    });
  }

  revalidatePath("/admin/guest-messages");
  revalidatePath("/admin/properties");
  redirect(
    `/admin/guest-messages?saved=1${applyToListings ? "&applied=1" : ""}`,
  );
}

/** Prefill host defaults with starter copy if empty. */
export async function loadStarterGuestMessageTemplates(formData: FormData) {
  const access = await ensureHostAccess();
  const hostId = await resolveHostIdForAccess(
    access,
    String(formData.get("hostId") || "") || undefined,
  );

  const host = await prisma.host.findUniqueOrThrow({ where: { id: hostId } });
  await prisma.host.update({
    where: { id: hostId },
    data: {
      defaultAutoMsgOnBookingBody:
        host.defaultAutoMsgOnBookingBody?.trim() || STARTER_TEMPLATES.ON_BOOKING,
      defaultAutoMsgWeekBeforeBody:
        host.defaultAutoMsgWeekBeforeBody?.trim() ||
        STARTER_TEMPLATES.WEEK_BEFORE,
      defaultAutoMsgDayBeforeBody:
        host.defaultAutoMsgDayBeforeBody?.trim() || STARTER_TEMPLATES.DAY_BEFORE,
      defaultAutoMsgOnBookingEnabled: true,
      defaultAutoMsgWeekBeforeEnabled: true,
      defaultAutoMsgDayBeforeEnabled: true,
    },
  });

  revalidatePath("/admin/guest-messages");
  redirect("/admin/guest-messages?saved=starters");
}

/**
 * Save automated booking messages for one listing (override scope).
 */
export async function savePropertyBookingMessages(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  if (!propertyId) throw new Error("Missing property");

  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(access) },
    select: { id: true, hostId: true },
  });
  if (!property) throw new Error("Property not found");

  const data = {
    autoMsgOnBookingEnabled: parseEnabled(formData, "autoMsgOnBookingEnabled"),
    autoMsgOnBookingBody: parseBody(formData, "autoMsgOnBookingBody"),
    autoMsgWeekBeforeEnabled: parseEnabled(
      formData,
      "autoMsgWeekBeforeEnabled",
    ),
    autoMsgWeekBeforeBody: parseBody(formData, "autoMsgWeekBeforeBody"),
    autoMsgDayBeforeEnabled: parseEnabled(formData, "autoMsgDayBeforeEnabled"),
    autoMsgDayBeforeBody: parseBody(formData, "autoMsgDayBeforeBody"),
  };

  // Enabling a listing override requires a body (otherwise leave empty to use host default)
  if (data.autoMsgOnBookingEnabled && !data.autoMsgOnBookingBody) {
    redirect(
      `/admin/properties/${propertyId}?tab=messages&error=on_booking_body`,
    );
  }
  if (data.autoMsgWeekBeforeEnabled && !data.autoMsgWeekBeforeBody) {
    redirect(
      `/admin/properties/${propertyId}?tab=messages&error=week_before_body`,
    );
  }
  if (data.autoMsgDayBeforeEnabled && !data.autoMsgDayBeforeBody) {
    redirect(
      `/admin/properties/${propertyId}?tab=messages&error=day_before_body`,
    );
  }

  await prisma.property.update({
    where: { id: propertyId },
    data,
  });

  revalidatePath(`/admin/properties/${propertyId}`);
  redirect(`/admin/properties/${propertyId}?tab=messages&saved=1`);
}

/**
 * Copy this listing’s auto-message templates to every other listing under the same host.
 */
export async function copyBookingMessagesToAllListings(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  if (!propertyId) throw new Error("Missing property");

  const source = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyScopeWhere(access) },
    select: {
      id: true,
      hostId: true,
      autoMsgOnBookingEnabled: true,
      autoMsgOnBookingBody: true,
      autoMsgWeekBeforeEnabled: true,
      autoMsgWeekBeforeBody: true,
      autoMsgDayBeforeEnabled: true,
      autoMsgDayBeforeBody: true,
    },
  });
  if (!source) throw new Error("Property not found");

  const result = await prisma.property.updateMany({
    where: {
      hostId: source.hostId,
      id: { not: source.id },
    },
    data: {
      autoMsgOnBookingEnabled: source.autoMsgOnBookingEnabled,
      autoMsgOnBookingBody: source.autoMsgOnBookingBody,
      autoMsgWeekBeforeEnabled: source.autoMsgWeekBeforeEnabled,
      autoMsgWeekBeforeBody: source.autoMsgWeekBeforeBody,
      autoMsgDayBeforeEnabled: source.autoMsgDayBeforeEnabled,
      autoMsgDayBeforeBody: source.autoMsgDayBeforeBody,
    },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${propertyId}`);
  redirect(
    `/admin/properties/${propertyId}?tab=messages&saved=copied&count=${result.count}`,
  );
}
