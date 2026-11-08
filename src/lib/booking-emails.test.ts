import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  booking: { updateMany: vi.fn(), findUnique: vi.fn() },
  host: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
}));
const mail = vi.hoisted(() => ({
  dispatchPlatformEmail: vi.fn(async () => ({
    attempted: true,
    status: "sent",
  })),
}));
const prefs = vi.hoisted(() => ({
  canSendEmailTo: vi.fn<(email: string) => Promise<boolean>>(async () => true),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/notification-prefs", () => prefs);
vi.mock("@/lib/messaging", () => ({
  ...mail,
  messagingSiteOrigin: () => "https://www.yallcomeback.app",
}));

import {
  bookingHostRecipients,
  composeBookingCreatedEmails,
  composeCancellationEmails,
  sendBookingConfirmedEmails,
  sendBookingCreatedEmails,
  sendCancellationEmails,
  type BookingEmailData,
} from "./booking-emails";
import { bookingAccessToken } from "./booking-access";

process.env.AUTH_SECRET = "test-secret-for-booking-links";

function booking(over: Partial<BookingEmailData> = {}): BookingEmailData {
  return {
    id: "cmvxw92p0000test",
    status: "PENDING_PAYMENT",
    guestName: "Test Guest",
    guestEmail: "ycb@mail.grokbot.com",
    guestPhone: null,
    guests: 2,
    pets: 0,
    nights: 3,
    checkIn: new Date("2027-03-10T00:00:00"),
    checkOut: new Date("2027-03-13T00:00:00"),
    createdAt: new Date("2026-11-01T14:00:00Z"),
    totalAmount: 450,
    depositAmount: 150,
    guestNotes: null,
    cancelReason: null,
    property: {
      title: "Motel Room 2",
      hostId: "host_1",
      checkInTime: "16:00",
      cancellationPolicy: "MODERATE",
      longTermCancellationPolicy: "FIRM",
      host: { name: "Hugh's Motel" },
    },
    payments: [
      {
        method: "MANUAL",
        status: "PENDING",
        amount: 150,
        notes: "Request to book (no payment method ready)",
        refundedAmount: null,
      },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("host recipients", () => {
  it("includes the contact email, billing email, owner and co-hosts, deduped", async () => {
    db.host.findUnique.mockResolvedValue({
      contactEmail: "Owner@Motel.com",
      billingEmail: "billing@motel.com",
    });
    db.user.findMany.mockResolvedValue([
      { email: "owner@motel.com" },
      { email: "cohost@motel.com" },
    ]);
    expect(await bookingHostRecipients("host_1")).toEqual([
      "owner@motel.com",
      "billing@motel.com",
      "cohost@motel.com",
    ]);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          hostId: "host_1",
          role: { in: ["HOST", "ADMIN"] },
          emailNotifications: true,
        },
      }),
    );
  });

  it("skips addresses that unsubscribed", async () => {
    db.host.findUnique.mockResolvedValue({
      contactEmail: "owner@motel.com",
      billingEmail: null,
    });
    db.user.findMany.mockResolvedValue([{ email: "cohost@motel.com" }]);
    prefs.canSendEmailTo.mockImplementation(
      async (e: string) => e !== "owner@motel.com",
    );
    expect(await bookingHostRecipients("host_1")).toEqual(["cohost@motel.com"]);
    prefs.canSendEmailTo.mockImplementation(async () => true);
  });
});

describe("booking-time emails", () => {
  it("K1 brand-context email manage/cancel links stay on the owning host", () => {
    const b = booking();
    b.sourceChannel = "host_site";
    b.property.host.slug = "qa-host";
    const guest = composeBookingCreatedEmails(b, ["owner@motel.com"])[0]!;
    expect(guest.text).toContain(`/h/qa-host/book/confirmation/${b.id}?t=`);
    expect(guest.text).toContain("&cancel=1");
    expect(guest.text).not.toContain("/marketplace");
  });

  it("guest gets request-received with manage + cancel links; each host gets a new-request email", () => {
    const b = booking();
    const emails = composeBookingCreatedEmails(
      b,
      ["owner@motel.com", "cohost@motel.com"],
      new Date("2026-11-01T15:00:00Z"),
    );
    expect(emails.map((e) => e.to)).toEqual([
      "ycb@mail.grokbot.com",
      "owner@motel.com",
      "cohost@motel.com",
    ]);
    const guest = emails[0]!;
    expect(guest.subject).toBe("Request received: Motel Room 2");
    const t = bookingAccessToken(b.id);
    expect(guest.text).toContain(
      `https://www.yallcomeback.app/book/confirmation/${b.id}?t=${t}`,
    );
    expect(guest.text).toContain(`?t=${t}&cancel=1`);
    expect(guest.text).toContain("Nothing was charged");
    expect(guest.text).toContain("You can cancel online until");
    expect(guest.text).toContain("Refunds are not automatic");
    expect(emails[1]!.subject).toMatch(/^New booking request: Motel Room 2/);
    expect(emails[1]!.text).toContain(
      `https://www.yallcomeback.app/admin/bookings/${b.id}`,
    );
    expect(emails[1]!.text).toContain("ycb@mail.grokbot.com");
  });

  it("paid card booking says confirmed", () => {
    const emails = composeBookingCreatedEmails(
      booking({
        status: "CONFIRMED",
        payments: [
          {
            method: "STRIPE",
            status: "PAID",
            amount: 150,
            notes: null,
            refundedAmount: null,
          },
        ],
      }),
      ["owner@motel.com"],
    );
    expect(emails[0]!.subject).toBe("Booking confirmed: Motel Room 2");
    expect(emails[1]!.subject).toMatch(/^New booking: /);
  });

  it("sends once per booking (claim) to guest and hosts", async () => {
    db.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    db.booking.findUnique.mockResolvedValue(booking());
    db.host.findUnique.mockResolvedValue({ contactEmail: "owner@motel.com" });
    db.user.findMany.mockResolvedValue([{ email: "cohost@motel.com" }]);
    await sendBookingCreatedEmails("cmvxw92p0000test");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(3);
    expect(db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: "cmvxw92p0000test", bookingEmailsSentAt: null },
      data: { bookingEmailsSentAt: expect.any(Date) },
    });

    db.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    await sendBookingCreatedEmails("cmvxw92p0000test");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(3);
  });

  it("never throws when email fails", async () => {
    db.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    db.booking.findUnique.mockResolvedValue(booking());
    db.host.findUnique.mockResolvedValue({ contactEmail: "owner@motel.com" });
    db.user.findMany.mockResolvedValue([]);
    mail.dispatchPlatformEmail.mockRejectedValueOnce(new Error("resend down"));
    await expect(sendBookingCreatedEmails("x")).resolves.toBeUndefined();
  });
});

describe("cancellation emails", () => {
  it("guest cancel, unpaid: both sides told, nothing to refund", () => {
    const emails = composeCancellationEmails(
      booking({ status: "CANCELLED" }),
      ["owner@motel.com"],
      "GUEST",
    );
    expect(emails.map((e) => e.to)).toEqual([
      "ycb@mail.grokbot.com",
      "owner@motel.com",
    ]);
    expect(emails[0]!.subject).toMatch(/^Cancelled: Motel Room 2/);
    expect(emails[0]!.text).toContain("cancelled by you");
    expect(emails[0]!.text).toContain("nothing to refund");
    expect(emails[1]!.text).toContain("Test Guest (the guest)");
    expect(emails[1]!.text).toContain("open on your calendar");
  });

  it("paid deposit: guest told refund is processed per policy, host flagged", () => {
    const emails = composeCancellationEmails(
      booking({
        status: "CANCELLED",
        payments: [
          {
            method: "STRIPE",
            status: "PAID",
            amount: 150,
            notes: null,
            refundedAmount: null,
          },
        ],
      }),
      ["owner@motel.com", "cohost@motel.com"],
      "HOST",
    );
    expect(emails).toHaveLength(3);
    expect(emails[0]!.text).toMatch(/Refunds are not automatic/);
    expect(emails[0]!.text).toContain("cancelled by the host (Hugh's Motel)");
    expect(emails[1]!.text).toContain("Refund review");
  });

  it("system refund (dates lost the race) mentions the refund", () => {
    const emails = composeCancellationEmails(
      booking({
        status: "CANCELLED",
        cancelReason: "Dates were taken",
        payments: [
          {
            method: "STRIPE",
            status: "REFUNDED",
            amount: 150,
            notes: null,
            refundedAmount: 150,
          },
        ],
      }),
      ["owner@motel.com"],
      "SYSTEM",
    );
    expect(emails[0]!.text).toContain("A refund of $150");
    expect(emails[0]!.text).toContain("Reason: Dates were taken");
    expect(emails[1]!.text).toContain("Yall Come Back automatically");
  });

  it("sendCancellationEmails claims once", async () => {
    db.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    await sendCancellationEmails("b1", "GUEST");
    expect(db.booking.findUnique).not.toHaveBeenCalled();
    expect(mail.dispatchPlatformEmail).not.toHaveBeenCalled();
  });
});

describe("booking confirmed emails (host marks deposit paid)", () => {
  const paidManual = {
    method: "MANUAL",
    status: "PAID",
    amount: 150,
    notes: "Cash at the door",
    refundedAmount: null,
  };

  function hostsFound() {
    db.host.findUnique.mockResolvedValue({ contactEmail: "owner@motel.com" });
    db.user.findMany.mockResolvedValue([]);
  }

  it("sends the guest the same confirmed email as the card path", async () => {
    // confirmation claim ok; booking-time emails already went out
    db.booking.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    db.booking.findUnique.mockResolvedValue(
      booking({ status: "CONFIRMED", payments: [paidManual] }),
    );
    hostsFound();
    await sendBookingConfirmedEmails("cmvxw92p0000test");

    expect(db.booking.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "cmvxw92p0000test",
        status: "CONFIRMED",
        confirmationEmailSentAt: null,
      },
      data: { confirmationEmailSentAt: expect.any(Date) },
    });
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
    const sent = mail.dispatchPlatformEmail.mock.calls[0] as unknown as [
      { to: string; subject: string; text: string },
    ];
    const cardPath = composeBookingCreatedEmails(
      booking({ status: "CONFIRMED", payments: [paidManual] }),
      [],
    )[0]!;
    expect(sent[0].to).toBe("ycb@mail.grokbot.com");
    expect(sent[0].subject).toBe("Booking confirmed: Motel Room 2");
    expect(sent[0].subject).toBe(cardPath.subject);
    expect(sent[0].text).toContain("Your deposit is paid.");
    expect(sent[0].text).toContain("Payment: Deposit $150");
  });

  it("does nothing when the confirmation was already sent", async () => {
    db.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    await sendBookingConfirmedEmails("cmvxw92p0000test");
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(db.booking.findUnique).not.toHaveBeenCalled();
    expect(mail.dispatchPlatformEmail).not.toHaveBeenCalled();
  });

  it("also emails hosts when the booking-time emails never went out", async () => {
    db.booking.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    db.booking.findUnique.mockResolvedValue(
      booking({ status: "CONFIRMED", payments: [paidManual] }),
    );
    hostsFound();
    await sendBookingConfirmedEmails("cmvxw92p0000test");
    const subjects = mail.dispatchPlatformEmail.mock.calls.map(
      (c) => (c as unknown as [{ subject: string }])[0].subject,
    );
    expect(subjects[0]).toBe("Booking confirmed: Motel Room 2");
    expect(subjects[1]).toMatch(/^New booking: /);
    expect(subjects).toHaveLength(2);
  });

  it("card webhook confirmation claims it, so mark-paid never duplicates", async () => {
    // Webhook: booking-time claim ok, then confirmation claim ok.
    db.booking.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    db.booking.findUnique.mockResolvedValue(
      booking({
        status: "CONFIRMED",
        payments: [{ ...paidManual, method: "STRIPE", notes: null }],
      }),
    );
    hostsFound();
    await sendBookingCreatedEmails("cmvxw92p0000test");
    expect(db.booking.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "cmvxw92p0000test",
        status: "CONFIRMED",
        confirmationEmailSentAt: null,
      },
      data: { confirmationEmailSentAt: expect.any(Date) },
    });
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(2);

    // Later mark-paid: confirmation claim fails → nothing sent.
    db.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    await sendBookingConfirmedEmails("cmvxw92p0000test");
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(2);
  });

  it("booking-time send skips the guest when mark-paid already confirmed", async () => {
    db.booking.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    db.booking.findUnique.mockResolvedValue(
      booking({ status: "CONFIRMED", payments: [paidManual] }),
    );
    hostsFound();
    await sendBookingCreatedEmails("cmvxw92p0000test");
    const to = mail.dispatchPlatformEmail.mock.calls.map(
      (c) => (c as unknown as [{ to: string }])[0].to,
    );
    expect(to).toEqual(["owner@motel.com"]);
  });

  it("never throws", async () => {
    db.booking.updateMany.mockRejectedValueOnce(new Error("db down"));
    await expect(sendBookingConfirmedEmails("x")).resolves.toBeUndefined();
  });
});
