import { beforeEach, describe, expect, it, vi } from "vitest";

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
  guestConfirmEmail,
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

describe("sendGuestInquiryConfirmation", () => {
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
