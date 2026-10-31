import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  booking: { findUnique: vi.fn(), update: vi.fn((a: unknown) => a) },
  payment: { update: vi.fn((a: unknown) => a) },
  calendarBlock: { deleteMany: vi.fn((a: unknown) => a) },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import {
  parseRefundAmount,
  refundBookingDeposit,
  refundableRemaining,
  SYSTEM_WEBHOOK_ACTOR,
} from "./booking-refunds";

function fakeStripe() {
  return {
    refunds: { create: vi.fn(async () => ({ id: "re_123" })) },
    checkout: { sessions: { retrieve: vi.fn(), list: vi.fn() } },
    paymentIntents: { search: vi.fn() },
  };
}

function bookingRow(payment: Record<string, unknown>) {
  return {
    id: "bk_1",
    status: "CONFIRMED",
    adminNotes: null,
    property: { host: { stripeAccountId: "acct_host" } },
    payments: [
      {
        id: "pay_1",
        method: "STRIPE",
        status: "PAID",
        amount: 200,
        refundedAmount: null,
        paidAt: new Date("2026-10-01T00:00:00Z"),
        stripePaymentIntentId: "pi_1",
        stripeSessionId: null,
        stripeAccountId: null,
        ...payment,
      },
    ],
  };
}

const admin = { userId: "u_admin", label: "admin@example.com" };

describe("refund amount parsing", () => {
  it("blank means full refund of what is left", () => {
    expect(parseRefundAmount("", 150)).toEqual({ ok: true, amount: 150, full: true });
    expect(parseRefundAmount("  ", 150)).toMatchObject({ full: true });
  });
  it("accepts a partial dollar amount", () => {
    expect(parseRefundAmount("$50.25", 150)).toEqual({ ok: true, amount: 50.25, full: false });
  });
  it("rejects junk, zero, negative, too many decimals, and over-refunds", () => {
    expect(parseRefundAmount("abc", 150).ok).toBe(false);
    expect(parseRefundAmount("0", 150).ok).toBe(false);
    expect(parseRefundAmount("-5", 150).ok).toBe(false);
    expect(parseRefundAmount("1.234", 150).ok).toBe(false);
    expect(parseRefundAmount("150.01", 150).ok).toBe(false);
    expect(parseRefundAmount("", 0).ok).toBe(false);
  });
  it("tracks what is still refundable", () => {
    expect(refundableRemaining({ amount: 200, refundedAmount: null })).toBe(200);
    expect(refundableRemaining({ amount: 200, refundedAmount: 50.5 })).toBe(149.5);
    expect(refundableRemaining({ amount: 200, refundedAmount: 200 })).toBe(0);
  });
});

describe("refundBookingDeposit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("full refund on the connected account marks the payment REFUNDED", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow({}));
    const stripe = fakeStripe();
    const res = await refundBookingDeposit({
      bookingId: "bk_1",
      actor: admin,
      reason: "Guest asked",
      stripe: stripe as never,
    });
    expect(res).toMatchObject({ ok: true, refundId: "re_123", amount: 200, full: true });
    const [params, opts] = stripe.refunds.create.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params.payment_intent).toBe("pi_1");
    expect(params).not.toHaveProperty("amount");
    expect(opts.stripeAccount).toBe("acct_host");
    expect(String(opts.idempotencyKey)).toMatch(/^refund:pay_1:/);
    const update = db.payment.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(update.data).toMatchObject({
      status: "REFUNDED",
      stripeRefundId: "re_123",
      refundedAmount: 200,
      refundedByUserId: "u_admin",
      refundedBy: "admin@example.com",
      refundReason: "Guest asked",
    });
    expect(db.calendarBlock.deleteMany).not.toHaveBeenCalled();
  });

  it("partial refund sends cents and keeps the payment PAID", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow({ refundedAmount: 20 }));
    const stripe = fakeStripe();
    const res = await refundBookingDeposit({
      bookingId: "bk_1",
      amountUsd: 30,
      actor: admin,
      stripe: stripe as never,
    });
    expect(res).toMatchObject({ ok: true, amount: 30, full: false });
    const [params] = stripe.refunds.create.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.amount).toBe(3000);
    const update = db.payment.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(update.data).toMatchObject({ status: "PAID", refundedAmount: 50 });
  });

  it("cancel option cancels the booking and frees the calendar", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow({}));
    const res = await refundBookingDeposit({
      bookingId: "bk_1",
      actor: admin,
      cancelBooking: true,
      stripe: fakeStripe() as never,
    });
    expect(res).toMatchObject({ ok: true, bookingStatus: "CANCELLED" });
    const b = db.booking.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(b.data.status).toBe("CANCELLED");
    expect(String(b.data.adminNotes)).toMatch(/Refunded \$200\.00 by admin@example\.com/);
    expect(db.calendarBlock.deleteMany).toHaveBeenCalledWith({ where: { bookingId: "bk_1" } });
  });

  it("refuses an over-refund without calling Stripe", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow({ refundedAmount: 190 }));
    const stripe = fakeStripe();
    const res = await refundBookingDeposit({
      bookingId: "bk_1",
      amountUsd: 20,
      actor: admin,
      stripe: stripe as never,
    });
    expect(res.ok).toBe(false);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
  });

  it("will not refund a PENDING payment unless the webhook allows it", async () => {
    db.booking.findUnique.mockResolvedValue(
      bookingRow({ status: "PENDING", stripePaymentIntentId: null }),
    );
    const stripe = fakeStripe();
    const denied = await refundBookingDeposit({
      bookingId: "bk_1",
      actor: admin,
      stripe: stripe as never,
    });
    expect(denied.ok).toBe(false);
    expect(stripe.refunds.create).not.toHaveBeenCalled();

    const ok = await refundBookingDeposit({
      bookingId: "bk_1",
      actor: { userId: null, label: SYSTEM_WEBHOOK_ACTOR },
      allowPending: true,
      paymentIntentId: "pi_race",
      accountId: "acct_event",
      idempotencyKey: "race-refund:bk_1",
      stripe: stripe as never,
    });
    expect(ok.ok).toBe(true);
    const [params, opts] = stripe.refunds.create.mock.calls[0] as unknown as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params.payment_intent).toBe("pi_race");
    expect(opts).toEqual({ stripeAccount: "acct_event", idempotencyKey: "race-refund:bk_1" });
  });

  it("finds the charge by PaymentIntent metadata when no id is stored", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow({ stripePaymentIntentId: null }));
    const stripe = fakeStripe();
    stripe.paymentIntents.search.mockResolvedValue({
      data: [{ id: "pi_found", status: "succeeded" }],
    });
    const res = await refundBookingDeposit({
      bookingId: "bk_1",
      actor: admin,
      stripe: stripe as never,
    });
    expect(res.ok).toBe(true);
    const [params] = stripe.refunds.create.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(params.payment_intent).toBe("pi_found");
  });
});
