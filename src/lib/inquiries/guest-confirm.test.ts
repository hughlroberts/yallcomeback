import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  conversation: { count: vi.fn(), updateMany: vi.fn() },
}));
const messaging = vi.hoisted(() => ({
  dispatchPlatformEmail: vi.fn(async () => ({
    attempted: true,
    status: "sent",
    channel: "EMAIL",
  })),
}));
const prefs = vi.hoisted(() => ({ canSendEmailTo: vi.fn(async () => true) }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/messaging", () => messaging);
vi.mock("@/lib/notification-prefs", () => prefs);
vi.mock("@/lib/features", () => ({
  canonicalSiteOrigin: () => "https://www.yallcomeback.app",
}));

import {
  GUEST_CONFIRM_LIMITS,
  GUEST_CONFIRM_MESSAGE_MAX,
  guestConfirmEmail,
  receiptMessageCopy,
  sendGuestInquiryConfirmation,
} from "./guest-confirm";

const base = {
  conversationId: "c1",
  guestEmail: "Jo@Example.com",
  hostName: "Hugh",
  propertyTitle: "Lakefront",
  propertySlug: "lakefront",
  now: new Date("2026-11-01T15:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  db.conversation.count.mockResolvedValue(0);
  db.conversation.updateMany.mockResolvedValue({ count: 1 });
  prefs.canSendEmailTo.mockResolvedValue(true);
});

describe("guestConfirmEmail", () => {
  it("names the host and listing, and links only to our own listing page", () => {
    const m = guestConfirmEmail({
      hostName: "Hugh",
      propertyTitle: "Lakefront",
      listingUrl:
        "https://www.yallcomeback.app/marketplace/properties/lakefront",
    });
    expect(m.subject).toBe("We sent your question to Hugh");
    expect(m.text).toContain("We sent your question about Lakefront to Hugh.");
    expect(m.text).toContain("If you didn't send this");
    const links = m.text.match(/https?:\/\/\S+/g) ?? [];
    expect(links).toEqual([
      "https://www.yallcomeback.app/marketplace/properties/lakefront",
    ]);
  });
});

describe("receipt details", () => {
  it("lists the listing, dates, guests, reference and a quoted copy", () => {
    const m = guestConfirmEmail({
      hostName: "Hugh",
      propertyTitle: "Lakefront",
      listingUrl:
        "https://www.yallcomeback.app/marketplace/properties/lakefront",
      reference: "conv123",
      trip: { checkIn: "2026-12-01", checkOut: "2026-12-04", guests: 3 },
      message: "Is the dock deep?\nWe have a pontoon.",
    });
    expect(m.text).toContain("Listing: Lakefront");
    expect(m.text).toContain("Dates: December 1, 2026 to December 4, 2026");
    expect(m.text).toContain("Guests: 3");
    expect(m.text).toContain("Inquiry reference: conv123");
    expect(m.text).toContain("> Is the dock deep?\n> We have a pontoon.");
  });

  it("removes links and addresses from the copy and caps its length", () => {
    const copy = receiptMessageCopy(
      "Win! https://evil.example/x or www.spam.test or evil.biz/p or mail a@b.co now",
    );
    expect(copy).toBe(
      "Win! [link removed] or [link removed] or [link removed] or mail [link removed] now",
    );
    const long = receiptMessageCopy("a ".repeat(2000))!;
    expect(long.length).toBeLessThanOrEqual(GUEST_CONFIRM_MESSAGE_MAX + 1);
    const m = guestConfirmEmail({
      hostName: "Hugh",
      propertyTitle: null,
      listingUrl: null,
      message: "see https://evil.example",
    });
    expect(m.text.match(/https?:\/\/\S+/g) ?? []).toEqual([]);
    expect(m.text).not.toContain("evil");
  });

  it("omits details it does not have", () => {
    const m = guestConfirmEmail({
      hostName: "Hugh",
      propertyTitle: null,
      listingUrl: null,
    });
    expect(m.text).not.toContain("Dates:");
    expect(m.text).not.toContain("Guests:");
    expect(m.text).not.toContain("Your message");
  });
});

describe("sendGuestInquiryConfirmation", () => {
  it("puts the thread id in the receipt as the reference", async () => {
    await sendGuestInquiryConfirmation({ ...base, message: "Hello" });
    const call = messaging.dispatchPlatformEmail.mock.calls[0] as unknown as [
      { text: string },
    ];
    expect(call[0].text).toContain("Inquiry reference: c1");
    expect(call[0].text).toContain("> Hello");
  });

  it("sends once and marks the thread", async () => {
    expect(await sendGuestInquiryConfirmation(base)).toBe("sent");
    expect(db.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", guestConfirmSentAt: null },
      data: { guestConfirmSentAt: base.now },
    });
    const call = messaging.dispatchPlatformEmail.mock.calls[0] as unknown as [
      { to: string; subject: string; text: string },
    ];
    expect(call[0].to).toBe("jo@example.com");
    expect(call[0].text).toContain(
      "https://www.yallcomeback.app/marketplace/properties/lakefront",
    );
  });

  it("caps receipts per address per hour and per day", async () => {
    db.conversation.count.mockResolvedValueOnce(GUEST_CONFIRM_LIMITS.perHour);
    expect(await sendGuestInquiryConfirmation(base)).toBe("capped");
    db.conversation.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(GUEST_CONFIRM_LIMITS.perDay);
    expect(await sendGuestInquiryConfirmation(base)).toBe("capped");
    expect(messaging.dispatchPlatformEmail).not.toHaveBeenCalled();
    // The cap counts every thread to this address, across all hosts.
    const where = db.conversation.count.mock.calls[0]![0].where;
    expect(where).not.toHaveProperty("hostId");
    expect(where.guestEmail).toMatchObject({ equals: "jo@example.com" });
  });

  it("respects email opt-out", async () => {
    prefs.canSendEmailTo.mockResolvedValue(false);
    expect(await sendGuestInquiryConfirmation(base)).toBe("opted_out");
    expect(messaging.dispatchPlatformEmail).not.toHaveBeenCalled();
  });

  it("does not send twice for the same thread", async () => {
    db.conversation.updateMany.mockResolvedValue({ count: 0 });
    expect(await sendGuestInquiryConfirmation(base)).toBe("skipped");
    expect(messaging.dispatchPlatformEmail).not.toHaveBeenCalled();
  });
});

describe("guest receipt: conversation link and logging (#7, #8)", () => {
  const KEY = "test-only-not-a-real-secret";
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = KEY;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prev;
  });

  it("links a guest without an account to the signed no-login thread", async () => {
    await sendGuestInquiryConfirmation(base);
    const call = messaging.dispatchPlatformEmail.mock.calls[0] as unknown as [
      { text: string },
    ];
    expect(call[0].text).toMatch(
      /View your conversation: https:\/\/www\.yallcomeback\.app\/messages\/c1\/guest\?t=\S+/,
    );
    expect(call[0].text).not.toContain(KEY);
  });

  it("links a signed-in guest to the sign-in thread page", async () => {
    await sendGuestInquiryConfirmation({ ...base, guestUserId: "u1" });
    const call = messaging.dispatchPlatformEmail.mock.calls[0] as unknown as [
      { text: string },
    ];
    expect(call[0].text).toContain(
      "View your conversation: https://www.yallcomeback.app/messages/c1\n",
    );
  });

  it("logs a capped receipt with a masked address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.conversation.count.mockResolvedValueOnce(GUEST_CONFIRM_LIMITS.perHour);
    await sendGuestInquiryConfirmation(base);
    expect(warn).toHaveBeenCalledWith(
      "[inquiry:guest-confirm]",
      expect.objectContaining({ conversationId: "c1", to: "jo***@example.com", outcome: "capped" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("jo@example.com");
    warn.mockRestore();
  });

  it("releases the cap slot when the send fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    messaging.dispatchPlatformEmail.mockResolvedValueOnce({
      attempted: true,
      status: "failed",
      channel: "EMAIL",
      detail: "domain not verified",
    } as never);
    expect(await sendGuestInquiryConfirmation(base)).toBe("not_sent");
    expect(db.conversation.updateMany).toHaveBeenLastCalledWith({
      where: { id: "c1", guestConfirmSentAt: base.now },
      data: { guestConfirmSentAt: null },
    });
    expect(warn).toHaveBeenCalledWith(
      "[inquiry:guest-confirm]",
      expect.objectContaining({ outcome: "not_sent", detail: "failed:domain not verified" }),
    );
    warn.mockRestore();
  });
});
