import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  booking: { findUnique: vi.fn(), updateMany: vi.fn() },
  calendarBlock: { deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
}));
const emails = vi.hoisted(() => ({ sendCancellationEmails: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/booking-emails", () => emails);
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));

import { cancelBookingRecord } from "./booking-cancel";

function row(payStatus: string, status = "PENDING_PAYMENT") {
  return {
    id: "b1",
    status,
    propertyId: "p1",
    totalAmount: 300,
    adminNotes: null,
    payments: [{ status: payStatus }],
  };
}

describe("cancelBookingRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.booking.updateMany.mockResolvedValue({ count: 1 });
    db.calendarBlock.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("cancels, frees the calendar, and emails guest + hosts", async () => {
    db.booking.findUnique.mockResolvedValue(row("PENDING"));
    const r = await cancelBookingRecord({
      bookingId: "b1",
      by: "GUEST",
      actorLabel: "g@x.com",
    });
    expect(r).toEqual({ ok: true, refundReviewNeeded: false });
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", status: { not: "CANCELLED" } },
      data: expect.objectContaining({
        status: "CANCELLED",
        cancelledBy: "GUEST",
        refundReviewNeeded: false,
      }),
    });
    expect(db.calendarBlock.deleteMany).toHaveBeenCalledWith({
      where: { bookingId: "b1" },
    });
    expect(emails.sendCancellationEmails).toHaveBeenCalledWith("b1", "GUEST");
  });

  it("flags paid deposits for refund review (no automatic refund)", async () => {
    db.booking.findUnique.mockResolvedValue(row("PAID", "CONFIRMED"));
    const r = await cancelBookingRecord({
      bookingId: "b1",
      by: "HOST",
      actorLabel: "host@x.com",
      reason: "Pipe burst",
    });
    expect(r).toEqual({ ok: true, refundReviewNeeded: true });
    const data = db.booking.updateMany.mock.calls[0]![0].data;
    expect(data.refundReviewNeeded).toBe(true);
    expect(data.cancelReason).toBe("Pipe burst");
    expect(data.adminNotes).toMatch(/refund review needed/);
  });

  it("does nothing for an already-cancelled booking", async () => {
    db.booking.findUnique.mockResolvedValue(row("PENDING", "CANCELLED"));
    const r = await cancelBookingRecord({
      bookingId: "b1",
      by: "GUEST",
      actorLabel: "g",
    });
    expect(r).toEqual({ ok: false, error: "already_cancelled" });
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(emails.sendCancellationEmails).not.toHaveBeenCalled();
  });

  it("does not touch Stripe", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("./booking-cancel.ts", import.meta.url),
      "utf8",
    );
    const imports = src
      .split("\n")
      .filter((l) => /import/.test(l))
      .join("\n");
    expect(imports).not.toMatch(/stripe|booking-refunds/i);
    expect(src).not.toMatch(/refundBookingDeposit|refunds\.create/);
  });
});
