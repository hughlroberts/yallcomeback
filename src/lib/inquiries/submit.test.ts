import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  property: { findFirst: vi.fn() },
  host: { findUnique: vi.fn() },
  conversation: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  booking: { findUnique: vi.fn() },
}));
const notify = vi.hoisted(() => ({
  flushHostInquiryEmails: vi.fn(async () => "emailed"),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/host", () => ({
  marketplacePropertyWhere: () => ({ published: true, onMarketplace: true }),
}));
vi.mock("@/lib/inquiries/notify", () => notify);
const guestConfirm = vi.hoisted(() => ({
  sendGuestInquiryConfirmation: vi.fn(async () => "sent"),
}));
vi.mock("@/lib/inquiries/guest-confirm", () => guestConfirm);

import { INQUIRY_RATE_LIMITS, submitInquiry, tripContextLine } from "./submit";

let ipSeq = 0;
const ctx = (over: object = {}) => ({
  source: "AGENT" as const,
  ip: `10.0.0.${++ipSeq}`,
  agentName: "TripBot",
  ...over,
});
const input = {
  propertySlug: "lakefront",
  guestName: "Jo Guest",
  guestEmail: "Jo@Example.com",
  body: "Is the dock deep enough for a pontoon boat?",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.property.findFirst.mockResolvedValue({
    id: "p1",
    slug: "lakefront",
    title: "Lakefront",
    hostId: "h1",
    host: { name: "Hugh" },
  });
  db.conversation.findMany.mockResolvedValue([]);
  db.conversation.count.mockResolvedValue(0);
  db.conversation.create.mockResolvedValue({ id: "conv1" });
});

describe("submitInquiry", () => {
  it("saves the question for the host inbox and emails the host", async () => {
    const r = await submitInquiry(input, ctx());
    expect(r).toEqual({
      ok: true,
      conversationId: "conv1",
      duplicate: false,
      hostNotification: "emailed",
    });
    expect(guestConfirm.sendGuestInquiryConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv1",
        guestEmail: "jo@example.com",
        hostName: "Hugh",
        propertyTitle: "Lakefront",
        propertySlug: "lakefront",
      }),
    );
    const data = db.conversation.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      hostId: "h1",
      propertyId: "p1",
      guestEmail: "jo@example.com",
      subject: "Question about Lakefront",
      inquirySource: "AGENT",
      inquiryAgent: "TripBot",
    });
    expect(data.messages.create).toMatchObject({
      senderRole: "GUEST",
      hostNotifyPending: true,
    });
    expect(notify.flushHostInquiryEmails).toHaveBeenCalledWith(
      "h1",
      expect.any(Date),
    );
    expect(db.property.findFirst.mock.calls[0]![0].where).toMatchObject({
      slug: "lakefront",
      onMarketplace: true,
    });
  });

  it("rejects spam before touching the database", async () => {
    const r = await submitInquiry(
      { ...input, body: "Buy SEO backlinks now, best SEO ranking" },
      ctx(),
    );
    expect(r).toMatchObject({ ok: false, status: 422, code: "spam" });
    expect(db.property.findFirst).not.toHaveBeenCalled();
  });

  it("404s an unknown listing", async () => {
    db.property.findFirst.mockResolvedValue(null);
    expect(await submitInquiry(input, ctx())).toMatchObject({
      ok: false,
      status: 404,
      code: "not_found",
    });
  });

  it("returns the existing thread for a repeated question (no new email)", async () => {
    db.conversation.findMany.mockResolvedValue([
      {
        id: "old",
        messages: [{ body: "is the dock deep enough for a pontoon boat" }],
      },
    ]);
    expect(await submitInquiry(input, ctx())).toEqual({
      ok: true,
      conversationId: "old",
      duplicate: true,
      hostNotification: "none",
    });
    expect(db.conversation.create).not.toHaveBeenCalled();
    expect(notify.flushHostInquiryEmails).not.toHaveBeenCalled();
    expect(guestConfirm.sendGuestInquiryConfirmation).not.toHaveBeenCalled();
  });

  it("enforces per-email / listing / host limits", async () => {
    db.conversation.count.mockResolvedValue(INQUIRY_RATE_LIMITS.hostPerDay);
    expect(await submitInquiry(input, ctx())).toMatchObject({
      ok: false,
      status: 429,
    });
    expect(db.conversation.create).not.toHaveBeenCalled();
  });

  it("limits one IP", async () => {
    const c = ctx();
    for (let i = 0; i < INQUIRY_RATE_LIMITS.ipPer10Min; i++) {
      db.conversation.findMany.mockResolvedValue([]);
      await submitInquiry({ ...input, body: `${input.body} ${i}` }, c);
    }
    expect(await submitInquiry(input, c)).toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
    });
  });

  it("still saves the question when the email step throws", async () => {
    notify.flushHostInquiryEmails.mockRejectedValueOnce(new Error("smtp"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await submitInquiry(input, ctx())).toMatchObject({
      ok: true,
      hostNotification: "queued",
    });
    err.mockRestore();
  });
});

describe("tripContextLine", () => {
  it("formats valid dates and guests and ignores junk", () => {
    expect(
      tripContextLine({
        checkIn: "2026-12-08",
        checkOut: "2026-12-10",
        guests: 4,
      }),
    ).toBe("Dates: 2026-12-08 to 2026-12-10 · Guests: 4");
    expect(tripContextLine({ checkIn: "soon", guests: "lots" })).toBeNull();
  });
});
