import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    booking: { findFirst: vi.fn(), update: vi.fn(() => "booking.update") },
    payment: { update: vi.fn(() => "payment.update") },
    calendarBlock: { updateMany: vi.fn(() => "calendarBlock.updateMany") },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  };
  return d;
});
const emails = vi.hoisted(() => ({
  sendBookingConfirmedEmails: vi.fn(async () => {}),
  sendBookingCreatedEmails: vi.fn(async () => {}),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/booking-emails", () => emails);
vi.mock("@/lib/scope", () => ({
  ensureHostAccess: vi.fn(async () => ({ role: "HOST", hostId: "host_1" })),
  bookingScopeWhere: () => ({ property: { hostId: "host_1" } }),
}));
vi.mock("@/lib/analytics", () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/tenant", () => ({ getRequestTenant: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { markDepositPaid } from "./bookings";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

function row(status: string) {
  return {
    id: "bk_1",
    status,
    propertyId: "prop_1",
    guestName: "Test Guest",
    totalAmount: 450,
    payments: [{ id: "pay_1", method: "MANUAL", status: "PENDING" }],
  };
}

describe("markDepositPaid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("confirms the booking, then sends the guest the confirmed email", async () => {
    db.booking.findFirst.mockResolvedValue(row("PENDING_PAYMENT"));
    await markDepositPaid(form({ bookingId: "bk_1", paymentMethod: "MANUAL" }));
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: "bk_1" },
      data: { status: "CONFIRMED" },
    });
    expect(db.$transaction).toHaveBeenCalledBefore(
      emails.sendBookingConfirmedEmails,
    );
    expect(emails.sendBookingConfirmedEmails).toHaveBeenCalledWith("bk_1");
    expect(emails.sendBookingCreatedEmails).not.toHaveBeenCalled();
  });

  it("does not email again for a booking that was already confirmed", async () => {
    db.booking.findFirst.mockResolvedValue(row("CONFIRMED"));
    await markDepositPaid(form({ bookingId: "bk_1" }));
    expect(emails.sendBookingConfirmedEmails).not.toHaveBeenCalled();
  });

  it("rejects a booking outside the host's scope without emailing", async () => {
    db.booking.findFirst.mockResolvedValue(null);
    await expect(markDepositPaid(form({ bookingId: "bk_x" }))).rejects.toThrow(
      "Booking not found",
    );
    expect(emails.sendBookingConfirmedEmails).not.toHaveBeenCalled();
  });
});
