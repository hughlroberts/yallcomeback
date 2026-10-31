/**
 * checkout.session.completed for a guest card deposit (kind=booking_deposit).
 *
 * Agent (pay-first) checkouts do not hold the calendar, so two guests can pay
 * for the same nights. The first webhook to lock the listing wins; any later
 * paid session for overlapping nights is refunded in full and its booking is
 * marked CANCELLED with the payment REFUNDED.
 */
import { prisma } from "@/lib/db";
import { isRangeAvailable, lockPropertyBookings } from "@/lib/availability";
import { refundBookingDeposit, SYSTEM_WEBHOOK_ACTOR } from "@/lib/booking-refunds";

export class DatesTakenError extends Error {
  constructor() {
    super("Dates taken after checkout");
    this.name = "DatesTakenError";
  }
}

export const RACE_REFUND_REASON =
  "Dates were taken by another paid booking before this payment completed. Automatic full refund.";

export type DepositSession = {
  id?: string;
  payment_status?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: { kind?: string; bookingId?: string } | null;
};

export type SettleOutcome =
  | "confirmed"
  | "refunded"
  | "already_settled"
  | "not_found"
  | "not_paid";

function idOf(v: string | { id?: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : (v.id ?? null);
}

/**
 * Whether a paid session should still settle this booking.
 * PENDING_PAYMENT always; an agent booking the expiry sweep already
 * cancelled is also eligible when no payment was recorded (late webhook).
 */
export function bookingAwaitsDeposit(booking: {
  status: string;
  sourceChannel: string;
  payments: { status: string }[];
}): boolean {
  if (booking.status === "PENDING_PAYMENT") return true;
  if (booking.status === "CANCELLED" && booking.sourceChannel === "agent") {
    return !booking.payments.some(
      (p) => p.status === "PAID" || p.status === "REFUNDED",
    );
  }
  return false;
}

export async function settleBookingDepositSession(
  session: DepositSession,
  connectedAccountId: string | null,
): Promise<SettleOutcome> {
  const bookingId = session.metadata?.bookingId;
  if (session.metadata?.kind !== "booking_deposit" || !bookingId) {
    return "not_found";
  }
  if (session.payment_status !== "paid") return "not_paid";

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: true,
      property: { select: { host: { select: { stripeAccountId: true } } } },
    },
  });
  if (!booking) return "not_found";
  if (!bookingAwaitsDeposit(booking)) return "already_settled";

  const paymentIntentId = idOf(session.payment_intent);
  const accountId =
    connectedAccountId || booking.property.host.stripeAccountId || null;
  const pending = booking.payments.find(
    (p) => p.method === "STRIPE" && p.status === "PENDING",
  );
  const stripeIds = {
    stripeSessionId: session.id ?? null,
    stripePaymentIntentId: paymentIntentId,
    stripeAccountId: accountId,
  };

  try {
    await prisma.$transaction(async (tx) => {
      await lockPropertyBookings(tx, booking.propertyId);
      const existing = await tx.calendarBlock.findFirst({
        where: { bookingId: booking.id },
        select: { id: true },
      });
      if (!existing) {
        const free = await isRangeAvailable(
          booking.propertyId,
          booking.checkIn,
          booking.checkOut,
          booking.id,
          tx,
        );
        if (!free) throw new DatesTakenError();
        await tx.calendarBlock.create({
          data: {
            propertyId: booking.propertyId,
            bookingId: booking.id,
            source: "BOOKING",
            startDate: booking.checkIn,
            endDate: booking.checkOut,
            occupantName: booking.guestName,
            paymentMethod: "STRIPE",
            notes: `Booking ${booking.id} (CONFIRMED)`,
          },
        });
      }
      if (pending) {
        await tx.payment.update({
          where: { id: pending.id },
          data: { status: "PAID", paidAt: new Date(), ...stripeIds },
        });
      }
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: "CONFIRMED" },
      });
    });
  } catch (e) {
    if (!(e instanceof DatesTakenError)) throw e;

    // Lost the race: record the Stripe ids, then refund in full.
    if (pending) {
      await prisma.payment.update({
        where: { id: pending.id },
        data: stripeIds,
      });
    }
    const result = await refundBookingDeposit({
      bookingId: booking.id,
      actor: { userId: null, label: SYSTEM_WEBHOOK_ACTOR },
      reason: RACE_REFUND_REASON,
      cancelBooking: true,
      allowPending: true,
      paymentIntentId,
      accountId,
      idempotencyKey: `race-refund:${booking.id}`,
    });
    if (!result.ok) {
      // Throw so the webhook returns 500 and Stripe retries.
      throw new Error(`Race refund failed for ${booking.id}: ${result.error}`);
    }
    console.warn("[stripe] dates taken; refunded losing deposit", booking.id);
    const { trackAnalyticsEvent } = await import("@/lib/analytics");
    trackAnalyticsEvent({
      name: "booking_cancelled",
      listingId: booking.propertyId,
      bookingId: booking.id,
      value: booking.totalAmount,
    });
    return "refunded";
  }

  const { trackAnalyticsEvent } = await import("@/lib/analytics");
  trackAnalyticsEvent({
    name: "booking_completed",
    listingId: booking.propertyId,
    bookingId: booking.id,
    value: booking.totalAmount,
  });
  return "confirmed";
}
