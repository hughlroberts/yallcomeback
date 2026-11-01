/**
 * One cancel path for guest self-cancel and host cancel: mark CANCELLED,
 * free the calendar, flag paid bookings for a manual refund review, and
 * email the guest and every host. Never issues a Stripe refund.
 */
import { prisma } from "@/lib/db";
import { sendCancellationEmails, type CancelledBy } from "@/lib/booking-emails";

export type CancelResult =
  | { ok: true; refundReviewNeeded: boolean }
  | { ok: false; error: "not_found" | "already_cancelled" };

export async function cancelBookingRecord(opts: {
  bookingId: string;
  by: CancelledBy;
  /** Who did it, for the admin notes trail (email or "guest"). */
  actorLabel: string;
  reason?: string | null;
  now?: Date;
}): Promise<CancelResult> {
  const now = opts.now ?? new Date();
  const booking = await prisma.booking.findUnique({
    where: { id: opts.bookingId },
    select: {
      id: true,
      status: true,
      propertyId: true,
      totalAmount: true,
      adminNotes: true,
      payments: { select: { status: true } },
    },
  });
  if (!booking) return { ok: false, error: "not_found" };
  if (booking.status === "CANCELLED") {
    return { ok: false, error: "already_cancelled" };
  }

  const paid = booking.payments.some((p) => p.status === "PAID");
  const reason = opts.reason?.trim().slice(0, 450) || null;
  const stamp = `[${now.toISOString()}] Cancelled by ${opts.by.toLowerCase()} (${opts.actorLabel})${reason ? `: ${reason}` : ""}${paid ? ". Deposit was paid: refund review needed (not refunded automatically)." : ""}`;

  const [updated] = await prisma.$transaction([
    prisma.booking.updateMany({
      where: { id: booking.id, status: { not: "CANCELLED" } },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledBy: opts.by,
        cancelReason: reason,
        refundReviewNeeded: paid,
        adminNotes: [booking.adminNotes, stamp].filter(Boolean).join("\n"),
      },
    }),
    prisma.calendarBlock.deleteMany({ where: { bookingId: booking.id } }),
  ]);
  if (updated.count === 0) return { ok: false, error: "already_cancelled" };

  await sendCancellationEmails(booking.id, opts.by);

  const { trackAnalyticsEvent } = await import("@/lib/analytics");
  trackAnalyticsEvent({
    name: "booking_cancelled",
    listingId: booking.propertyId,
    bookingId: booking.id,
    value: booking.totalAmount,
  });
  return { ok: true, refundReviewNeeded: paid };
}
