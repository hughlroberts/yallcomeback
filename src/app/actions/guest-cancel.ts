"use server";

import { guestFlowPath, sameBrand } from "@/lib/branded-flow";
import { getRequestTenant } from "@/lib/tenant";

import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  bookingAccessToken,
  verifyBookingAccessToken,
} from "@/lib/booking-access";
import { guestCancelWindow } from "@/lib/guest-cancel-window";
import { cancelBookingRecord } from "@/lib/booking-cancel";

/**
 * Guest self-cancel from /book/confirmation/[id]?t=token.
 * Authorized by the same private token as the page (or the signed-in,
 * verified guest). Re-checks the policy deadline on the server.
 * Never refunds: paid bookings are flagged for the host.
 */
export async function guestCancelBooking(formData: FormData) {
  const bookingId = String(formData.get("bookingId") || "").trim();
  const token = String(formData.get("t") || "").trim();
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!bookingId) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      userId: true,
      guestEmail: true,
      nights: true,
      checkIn: true,
      createdAt: true,
      property: {
        select: {
          host: { select: { slug: true } },
          checkInTime: true,
          cancellationPolicy: true,
          longTermCancellationPolicy: true,
        },
      },
    },
  });
  if (!booking) notFound();

  let allowed = verifyBookingAccessToken(bookingId, token);
  if (!allowed) {
    const session = await auth();
    const uid = session?.user?.id;
    if (uid) {
      if (booking.userId === uid) allowed = true;
      else {
        const viewer = await prisma.user.findUnique({
          where: { id: uid },
          select: { email: true, emailVerifiedAt: true },
        });
        allowed = Boolean(
          viewer?.emailVerifiedAt &&
          viewer.email.toLowerCase() === booking.guestEmail.toLowerCase(),
        );
      }
    }
  }
  if (!allowed) notFound();

  const tenant = await getRequestTenant();
  if (!sameBrand(tenant?.slug, booking.property.host?.slug ?? "")) notFound();
  const back = (q: string) =>
    redirect(
      guestFlowPath(tenant?.slug, `/book/confirmation/${bookingId}?t=${bookingAccessToken(bookingId)}&${q}`),
    );

  if (booking.status === "CANCELLED") back("cancelled=1");
  if (booking.status === "COMPLETED") back("cancelError=completed");

  const win = guestCancelWindow({
    nights: booking.nights,
    checkIn: booking.checkIn,
    createdAt: booking.createdAt,
    checkInTime: booking.property.checkInTime,
    cancellationPolicy: booking.property.cancellationPolicy,
    longTermCancellationPolicy: booking.property.longTermCancellationPolicy,
  });
  if (!win.canCancelOnline) back("cancelError=deadline");

  const result = await cancelBookingRecord({
    bookingId,
    by: "GUEST",
    actorLabel: booking.guestEmail,
    reason,
  });

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  if (!result.ok && result.error === "not_found") notFound();
  back("cancelled=1");
}
