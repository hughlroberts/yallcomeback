/**
 * Stripe refunds for guest card deposits (Direct Charges on the host's
 * connected account). Used by:
 *  - the platform-admin refund button (admin booking detail), and
 *  - the deposit webhook when a paid agent checkout lost the dates.
 */
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { requireStripeClient, toStripeAmount } from "@/lib/stripe";

export const SYSTEM_WEBHOOK_ACTOR = "system:stripe-webhook";

export type RefundActor = { userId: string | null; label: string };

/** Round to cents in major units. */
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/** How much of this payment can still be refunded (USD). */
export function refundableRemaining(payment: {
  amount: number;
  refundedAmount: number | null;
}): number {
  return Math.max(0, cents(payment.amount - (payment.refundedAmount ?? 0)));
}

/**
 * Parse the optional admin amount. Blank → full remaining amount.
 * Returns USD (major units).
 */
export function parseRefundAmount(
  raw: string | null | undefined,
  remaining: number,
): { ok: true; amount: number; full: boolean } | { ok: false; error: string } {
  if (!(remaining > 0)) {
    return { ok: false, error: "Nothing left to refund on this payment." };
  }
  const text = (raw ?? "").trim().replace(/^\$/, "").replace(/,/g, "");
  if (!text) return { ok: true, amount: cents(remaining), full: true };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return { ok: false, error: "Enter a dollar amount like 50 or 50.25." };
  }
  const amount = cents(Number(text));
  if (!(amount > 0)) {
    return { ok: false, error: "Refund amount must be greater than 0." };
  }
  if (amount > remaining + 1e-9) {
    return {
      ok: false,
      error: `Refund cannot exceed the $${remaining.toFixed(2)} still refundable.`,
    };
  }
  return { ok: true, amount, full: Math.abs(amount - remaining) < 0.005 };
}

function idOf(v: string | { id?: string } | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.id ?? null;
}

/**
 * Find the PaymentIntent for a booking deposit on the connected account.
 * Order: stored PI → stored Checkout Session → PI metadata search →
 * scan recent Checkout Sessions for metadata.bookingId.
 */
export async function resolveDepositPaymentIntent(opts: {
  stripe: Stripe;
  accountId: string;
  bookingId: string;
  paymentIntentId?: string | null;
  sessionId?: string | null;
}): Promise<string | null> {
  const { stripe, accountId, bookingId } = opts;
  const req = { stripeAccount: accountId };
  if (opts.paymentIntentId) return opts.paymentIntentId;
  if (opts.sessionId) {
    const s = await stripe.checkout.sessions.retrieve(opts.sessionId, {}, req);
    const pi = idOf(s.payment_intent as string | { id?: string } | null);
    if (pi) return pi;
  }
  try {
    const found = await stripe.paymentIntents.search(
      {
        query: `metadata['bookingId']:'${bookingId.replace(/'/g, "")}'`,
        limit: 5,
      },
      req,
    );
    const paid = found.data.find((p) => p.status === "succeeded");
    if (paid) return paid.id;
  } catch {
    /* search can lag or be unavailable; fall through to session scan */
  }
  let seen = 0;
  for await (const s of stripe.checkout.sessions.list(
    { limit: 100, status: "complete" },
    req,
  )) {
    seen += 1;
    if (s.metadata?.bookingId === bookingId) {
      const pi = idOf(s.payment_intent as string | { id?: string } | null);
      if (pi) return pi;
    }
    if (seen >= 500) break;
  }
  return null;
}

export type RefundResult =
  | {
      ok: true;
      refundId: string;
      amount: number;
      full: boolean;
      bookingStatus: string;
    }
  | { ok: false; error: string };

/**
 * Issue a Stripe refund for a booking's card deposit and record it.
 * amountUsd null/undefined → refund everything still refundable.
 */
export async function refundBookingDeposit(opts: {
  bookingId: string;
  amountUsd?: number | null;
  actor: RefundActor;
  reason?: string | null;
  /** Cancel the booking and free its calendar nights. */
  cancelBooking?: boolean;
  /** Use when the caller already knows the PI / account (webhook). */
  paymentIntentId?: string | null;
  accountId?: string | null;
  idempotencyKey?: string;
  /** Webhook only: the card was charged but the payment row is still PENDING. */
  allowPending?: boolean;
  stripe?: Stripe;
}): Promise<RefundResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: opts.bookingId },
    include: {
      payments: { orderBy: { createdAt: "asc" } },
      property: { select: { host: { select: { stripeAccountId: true } } } },
    },
  });
  if (!booking) return { ok: false, error: "Booking not found." };

  const payment = booking.payments.find(
    (p) =>
      p.method === "STRIPE" &&
      (p.status === "PAID" ||
        // Webhook race path: the card was charged but the row never flipped.
        (p.status === "PENDING" && Boolean(opts.allowPending))),
  );
  if (!payment) {
    return {
      ok: false,
      error: "No paid card deposit on this booking to refund.",
    };
  }

  const remaining = refundableRemaining(payment);
  const parsed = parseRefundAmount(
    opts.amountUsd != null ? String(opts.amountUsd) : "",
    remaining,
  );
  if (!parsed.ok) return parsed;

  const accountId =
    opts.accountId ||
    payment.stripeAccountId ||
    booking.property.host.stripeAccountId;
  if (!accountId) {
    return {
      ok: false,
      error: "Host has no Stripe connected account on file.",
    };
  }

  const stripe = opts.stripe ?? requireStripeClient();
  const pi = await resolveDepositPaymentIntent({
    stripe,
    accountId,
    bookingId: booking.id,
    paymentIntentId: opts.paymentIntentId || payment.stripePaymentIntentId,
    sessionId: payment.stripeSessionId,
  });
  if (!pi) {
    return {
      ok: false,
      error:
        "Could not find the Stripe charge for this booking. Refund it in the host's Stripe Dashboard.",
    };
  }

  const refund = await stripe.refunds.create(
    {
      payment_intent: pi,
      ...(parsed.full ? {} : { amount: toStripeAmount(parsed.amount) }),
      reason: "requested_by_customer",
      metadata: {
        bookingId: booking.id,
        paymentId: payment.id,
        refundedBy: opts.actor.label.slice(0, 200),
        ...(opts.reason ? { note: opts.reason.slice(0, 450) } : {}),
      },
    },
    {
      stripeAccount: accountId,
      idempotencyKey:
        opts.idempotencyKey ??
        `refund:${payment.id}:${toStripeAmount(parsed.amount)}:${toStripeAmount(payment.refundedAmount ?? 0)}`,
    },
  );

  const now = new Date();
  const totalRefunded = cents((payment.refundedAmount ?? 0) + parsed.amount);
  const fullyRefunded = totalRefunded >= payment.amount - 0.005;
  const cancel = Boolean(opts.cancelBooking);
  const stamp = `[${now.toISOString()}] Refunded $${parsed.amount.toFixed(2)} by ${opts.actor.label} (${refund.id})${opts.reason ? `: ${opts.reason}` : ""}`;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: fullyRefunded ? "REFUNDED" : "PAID",
        paidAt: payment.paidAt ?? now,
        stripePaymentIntentId: pi,
        stripeAccountId: accountId,
        stripeRefundId: refund.id,
        refundedAmount: totalRefunded,
        refundedAt: now,
        refundedByUserId: opts.actor.userId,
        refundedBy: opts.actor.label,
        refundReason: opts.reason ?? null,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        ...(cancel
          ? {
              status: "CANCELLED" as const,
              cancelledAt: now,
              cancelledBy:
                opts.actor.label === SYSTEM_WEBHOOK_ACTOR ? "SYSTEM" : "HOST",
              cancelReason: opts.reason ?? null,
            }
          : {}),
        adminNotes: [booking.adminNotes, stamp].filter(Boolean).join("\n"),
      },
    }),
    ...(cancel
      ? [prisma.calendarBlock.deleteMany({ where: { bookingId: booking.id } })]
      : []),
  ]);

  return {
    ok: true,
    refundId: refund.id,
    amount: parsed.amount,
    full: fullyRefunded,
    bookingStatus: cancel ? "CANCELLED" : booking.status,
  };
}
