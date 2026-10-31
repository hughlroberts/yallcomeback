import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = vi.hoisted(() => ({
  calendarBlock: { findFirst: vi.fn(), create: vi.fn() },
  payment: { update: vi.fn() },
  booking: { update: vi.fn() },
}));
const db = vi.hoisted(() => ({
  booking: { findUnique: vi.fn() },
  payment: { update: vi.fn() },
  $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
}));
const avail = vi.hoisted(() => ({
  isRangeAvailable: vi.fn(),
  lockPropertyBookings: vi.fn(async () => {}),
}));
const refunds = vi.hoisted(() => ({ refundBookingDeposit: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/availability", () => avail);
vi.mock("@/lib/booking-refunds", () => ({
  ...refunds,
  SYSTEM_WEBHOOK_ACTOR: "system:stripe-webhook",
}));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));

import {
  bookingAwaitsDeposit,
  settleBookingDepositSession,
} from "./booking-deposit-webhook";

const session = {
  id: "cs_1",
  payment_status: "paid",
  payment_intent: "pi_1",
  metadata: { kind: "booking_deposit", bookingId: "bk_1" },
};

function agentBooking(over: Record<string, unknown> = {}) {
  return {
    id: "bk_1",
    status: "PENDING_PAYMENT",
    sourceChannel: "agent",
    propertyId: "prop_1",
    checkIn: new Date("2026-12-01T00:00:00Z"),
    checkOut: new Date("2026-12-04T00:00:00Z"),
    guestName: "Guest",
    totalAmount: 600,
    property: { host: { stripeAccountId: "acct_host" } },
    payments: [{ id: "pay_1", method: "STRIPE", status: "PENDING" }],
    ...over,
  };
}

describe("deposit webhook settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.calendarBlock.findFirst.mockResolvedValue(null);
  });

  it("confirms and writes the calendar when the dates are still free", async () => {
    db.booking.findUnique.mockResolvedValue(agentBooking());
    avail.isRangeAvailable.mockResolvedValue(true);
    const out = await settleBookingDepositSession(session, "acct_evt");
    expect(out).toBe("confirmed");
    expect(avail.lockPropertyBookings).toHaveBeenCalledWith(tx, "prop_1");
    expect(tx.calendarBlock.create).toHaveBeenCalled();
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      data: expect.objectContaining({
        status: "PAID",
        stripeSessionId: "cs_1",
        stripePaymentIntentId: "pi_1",
        stripeAccountId: "acct_evt",
      }),
    });
    expect(tx.booking.update).toHaveBeenCalledWith({
      where: { id: "bk_1" },
      data: { status: "CONFIRMED" },
    });
    expect(refunds.refundBookingDeposit).not.toHaveBeenCalled();
  });

  it("refunds in full and cancels when another paid booking took the dates", async () => {
    db.booking.findUnique.mockResolvedValue(agentBooking());
    avail.isRangeAvailable.mockResolvedValue(false);
    refunds.refundBookingDeposit.mockResolvedValue({ ok: true, refundId: "re_1" });
    const out = await settleBookingDepositSession(session, "acct_evt");
    expect(out).toBe("refunded");
    expect(tx.calendarBlock.create).not.toHaveBeenCalled();
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(refunds.refundBookingDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "bk_1",
        cancelBooking: true,
        allowPending: true,
        paymentIntentId: "pi_1",
        accountId: "acct_evt",
        idempotencyKey: "race-refund:bk_1",
        actor: { userId: null, label: "system:stripe-webhook" },
      }),
    );
    expect(refunds.refundBookingDeposit.mock.calls[0][0]).not.toHaveProperty("amountUsd");
  });

  it("throws (so Stripe retries) when the race refund fails", async () => {
    db.booking.findUnique.mockResolvedValue(agentBooking());
    avail.isRangeAvailable.mockResolvedValue(false);
    refunds.refundBookingDeposit.mockResolvedValue({ ok: false, error: "nope" });
    await expect(settleBookingDepositSession(session, null)).rejects.toThrow(/Race refund failed/);
  });

  it("is idempotent for an already confirmed booking", async () => {
    db.booking.findUnique.mockResolvedValue(
      agentBooking({ status: "CONFIRMED", payments: [{ id: "pay_1", method: "STRIPE", status: "PAID" }] }),
    );
    expect(await settleBookingDepositSession(session, null)).toBe("already_settled");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("ignores unpaid sessions", async () => {
    expect(
      await settleBookingDepositSession({ ...session, payment_status: "unpaid" }, null),
    ).toBe("not_paid");
  });

  it("still settles an agent booking the expiry sweep cancelled before the webhook", () => {
    expect(
      bookingAwaitsDeposit({
        status: "CANCELLED",
        sourceChannel: "agent",
        payments: [{ status: "PENDING" }],
      }),
    ).toBe(true);
    expect(
      bookingAwaitsDeposit({
        status: "CANCELLED",
        sourceChannel: "agent",
        payments: [{ status: "REFUNDED" }],
      }),
    ).toBe(false);
    expect(
      bookingAwaitsDeposit({ status: "CANCELLED", sourceChannel: "website", payments: [] }),
    ).toBe(false);
  });
});
