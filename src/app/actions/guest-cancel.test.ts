import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  booking: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const cancel = vi.hoisted(() => ({ cancelBookingRecord: vi.fn() }));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
const authMock = vi.hoisted(() => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/booking-cancel", () => cancel);
vi.mock("next/navigation", () => nav);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => authMock);

process.env.AUTH_SECRET = "test-secret-for-guest-cancel";

import { guestCancelBooking } from "./guest-cancel";
import { bookingAccessToken } from "@/lib/booking-access";

const DAY = 24 * 60 * 60 * 1000;

function bookingRow(over: Record<string, unknown> = {}) {
  const checkIn = new Date(Date.now() + 40 * DAY);
  checkIn.setHours(0, 0, 0, 0);
  return {
    id: "bk_1",
    status: "PENDING_PAYMENT",
    userId: null,
    guestEmail: "ycb@mail.grokbot.com",
    nights: 3,
    checkIn,
    createdAt: new Date(Date.now() - 2 * DAY),
    property: {
      checkInTime: "16:00",
      cancellationPolicy: "MODERATE",
      longTermCancellationPolicy: "FIRM",
    },
    ...over,
  };
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("guestCancelBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancel.cancelBookingRecord.mockResolvedValue({
      ok: true,
      refundReviewNeeded: false,
    });
  });

  it("rejects a missing or wrong token", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow());
    await expect(
      guestCancelBooking(form({ bookingId: "bk_1", t: "0".repeat(32) })),
    ).rejects.toThrow("NOT_FOUND");
    expect(cancel.cancelBookingRecord).not.toHaveBeenCalled();
  });

  it("cancels with the booking's token and returns to the page", async () => {
    db.booking.findUnique.mockResolvedValue(bookingRow());
    const t = bookingAccessToken("bk_1");
    await expect(
      guestCancelBooking(
        form({ bookingId: "bk_1", t, reason: "Plans changed" }),
      ),
    ).rejects.toThrow(`REDIRECT:/book/confirmation/bk_1?t=${t}&cancelled=1`);
    expect(cancel.cancelBookingRecord).toHaveBeenCalledWith({
      bookingId: "bk_1",
      by: "GUEST",
      actorLabel: "ycb@mail.grokbot.com",
      reason: "Plans changed",
    });
  });

  it("past the policy deadline: no cancel, page shows contact host", async () => {
    const checkIn = new Date(Date.now() + 2 * DAY);
    checkIn.setHours(0, 0, 0, 0);
    db.booking.findUnique.mockResolvedValue(bookingRow({ checkIn }));
    const t = bookingAccessToken("bk_1");
    await expect(
      guestCancelBooking(form({ bookingId: "bk_1", t })),
    ).rejects.toThrow("cancelError=deadline");
    expect(cancel.cancelBookingRecord).not.toHaveBeenCalled();
  });

  it("already cancelled: no second cancel", async () => {
    db.booking.findUnique.mockResolvedValue(
      bookingRow({ status: "CANCELLED" }),
    );
    const t = bookingAccessToken("bk_1");
    await expect(
      guestCancelBooking(form({ bookingId: "bk_1", t })),
    ).rejects.toThrow("cancelled=1");
    expect(cancel.cancelBookingRecord).not.toHaveBeenCalled();
  });
});
