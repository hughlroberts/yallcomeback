"use server";

import { listingDisplayTitle } from "@/lib/listing-display-title";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertHostAllowsFutureWork } from "@/lib/hosting";
import { assertEmailVerifiedForPublish } from "@/lib/email-verified";
import { assertPropertyAccess, ensureHostAccess, type HostAccess } from "@/lib/scope";
import { canDeleteListings, resolveHostAccessInfo } from "@/lib/host-access";
import {
  ACTIVE_BOOKING_STATUSES,
  deleteConfirmMatches,
} from "@/lib/listing-lifecycle";
import { queueListingBillingSync } from "@/lib/marketplace-billing-queue";

/**
 * Listing lifecycle: pause / resume, archive / restore, delete.
 * Each action returns a result (not a throw) so the reason reaches the host in
 * production builds, where thrown server-action messages are hidden.
 */
export type ListingLifecycleResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "You cannot change this listing.";

function fail(error: string): ListingLifecycleResult {
  return { ok: false, error };
}

function canRemove(access: HostAccess): boolean {
  return canDeleteListings(
    resolveHostAccessInfo({
      isPlatform: access.isPlatform,
      hostId: access.hostId,
      hostAccess: access.hostAccess,
    }),
  );
}

/** Brand-scoped lookup. Returns null when the listing is not in the active brand. */
async function scopedListing(formData: FormData) {
  let access: HostAccess;
  try {
    access = await ensureHostAccess();
  } catch {
    return null;
  }
  const id = String(formData.get("id") || "").trim();
  if (!id) return null;
  try {
    const property = await assertPropertyAccess(id, access);
    return { access, property };
  } catch {
    return null;
  }
}

async function revalidateListing(id: string, hostId: string, slug: string) {
  // T45: Marketplace bill follows the published listings (next bill only).
  queueListingBillingSync(hostId);
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { slug: true },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath("/marketplace");
  revalidatePath(`/properties/${slug}`);
  if (host) {
    revalidatePath(`/h/${host.slug}`);
    revalidatePath(`/h/${host.slug}/properties/${slug}`);
  }
}

/** Pause: stop new bookings and hide the listing. Keeps all data and the marketplace choice. */
export async function pauseListing(formData: FormData): Promise<ListingLifecycleResult> {
  const scoped = await scopedListing(formData);
  if (!scoped) return fail(NOT_ALLOWED);
  const { property } = scoped;
  if (property.published) {
    await prisma.property.update({
      where: { id: property.id },
      data: { published: false },
    });
  }
  await revalidateListing(property.id, property.hostId, property.slug);
  return { ok: true };
}

/** Resume: take bookings again (same place it was listed before the pause). */
export async function resumeListing(formData: FormData): Promise<ListingLifecycleResult> {
  const scoped = await scopedListing(formData);
  if (!scoped) return fail(NOT_ALLOWED);
  const { access, property } = scoped;
  if (property.archivedAt) {
    return fail("Restore this listing before you resume bookings.");
  }
  if (!property.title.trim() || property.title === "Untitled listing") {
    return fail("Finish setup before you resume bookings.");
  }
  if (!property.published) {
    try {
      await assertHostAllowsFutureWork(property.hostId, { bypass: access.isPlatform });
      await assertEmailVerifiedForPublish({
        userId: access.session.user.id,
        bypass: access.isPlatform,
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "You cannot resume bookings now.");
    }
    await prisma.property.update({
      where: { id: property.id },
      data: { published: true },
    });
  }
  await revalidateListing(property.id, property.hostId, property.slug);
  return { ok: true };
}

/** Archive: remove from the active list, hide publicly, block bookings. Keeps all data. */
export async function archiveListing(formData: FormData): Promise<ListingLifecycleResult> {
  const scoped = await scopedListing(formData);
  if (!scoped) return fail(NOT_ALLOWED);
  if (!canRemove(scoped.access)) {
    return fail("Your access level cannot archive listings.");
  }
  const { property } = scoped;
  await prisma.property.update({
    where: { id: property.id },
    data: {
      archivedAt: property.archivedAt ?? new Date(),
      published: false,
    },
  });
  await revalidateListing(property.id, property.hostId, property.slug);
  return { ok: true };
}

/** Restore: back to the active list as paused. The host turns bookings on again. */
export async function restoreListing(formData: FormData): Promise<ListingLifecycleResult> {
  const scoped = await scopedListing(formData);
  if (!scoped) return fail(NOT_ALLOWED);
  if (!canRemove(scoped.access)) {
    return fail("Your access level cannot restore listings.");
  }
  const { property } = scoped;
  await prisma.property.update({
    where: { id: property.id },
    data: { archivedAt: null, published: false },
  });
  await revalidateListing(property.id, property.hostId, property.slug);
  return { ok: true };
}

/**
 * Delete forever. Needs the listing name typed back. Blocked while the listing
 * has upcoming or current stays, or has payment records (archive keeps those).
 */
export async function deleteListing(formData: FormData): Promise<ListingLifecycleResult> {
  const scoped = await scopedListing(formData);
  if (!scoped) return fail(NOT_ALLOWED);
  if (!canRemove(scoped.access)) {
    return fail("Your access level cannot delete listings.");
  }
  const { property } = scoped;
  const typed = String(formData.get("confirmTitle") ?? "");
  if (
    !deleteConfirmMatches(property.title, typed) &&
    !deleteConfirmMatches(listingDisplayTitle(property), typed)
  ) {
    return fail("Type the listing name exactly to delete it.");
  }

  const now = new Date();
  const outcome = await prisma.$transaction(async (tx) => {
    const activeStays = await tx.booking.count({
      where: {
        propertyId: property.id,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        checkOut: { gte: now },
      },
    });
    if (activeStays > 0) return { blocked: "stays" as const, count: activeStays };
    const payments = await tx.payment.count({
      where: { booking: { propertyId: property.id } },
    });
    if (payments > 0) return { blocked: "payments" as const, count: payments };
    // Conversations keep their messages (propertyId is set to null).
    // Photos, prices, calendar holds, iCal links, view counts, pricing tips and
    // past unpaid bookings are removed by the database cascade.
    await tx.property.delete({ where: { id: property.id } });
    return { blocked: null, count: 0 };
  });

  if (outcome.blocked === "stays") {
    return fail(
      `This listing has ${outcome.count} upcoming or current stay${outcome.count === 1 ? "" : "s"}. You cannot delete it. Archive it instead: guests cannot find or book it, and those stays stay on your calendar.`,
    );
  }
  if (outcome.blocked === "payments") {
    return fail(
      "This listing has payment records from past stays. You cannot delete it. Archive it instead to keep those records.",
    );
  }
  await revalidateListing(property.id, property.hostId, property.slug);
  return { ok: true };
}
