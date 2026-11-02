import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  property: { findFirst: vi.fn() },
  host: { findUnique: vi.fn() },
  conversation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
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

import {
  INQUIRY_RATE_LIMITS,
  parseTrip,
  submitInquiry,
  tripContextLine,
} from "./submit";

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
  db.conversation.findFirst.mockResolvedValue(null);
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

  it("names the DB limit hit and when to retry", async () => {
    const now = new Date("2026-11-02T15:00:00Z");
    // email_per_hour is the first rule; oldest counted 20 min ago → 40 min left
    db.conversation.count.mockResolvedValueOnce(INQUIRY_RATE_LIMITS.emailPerHour);
    db.conversation.findFirst.mockResolvedValueOnce({
      createdAt: new Date(now.getTime() - 20 * 60_000),
    });
    expect(await submitInquiry(input, ctx({ now }))).toEqual({
      ok: false,
      status: 429,
      code: "rate_limited",
      error: expect.any(String),
      limit: { name: "email_per_hour", max: 3, windowSeconds: 3600 },
      retryAfterSeconds: 40 * 60,
    });
  });

  it("duplicates (200, duplicate:true) do not use up the per-IP limit", async () => {
    const c = ctx();
    db.conversation.findMany.mockResolvedValue([
      { id: "old", messages: [{ body: input.body }] },
    ]);
    for (let i = 0; i < INQUIRY_RATE_LIMITS.ipPer10Min + 3; i++) {
      expect(await submitInquiry(input, c)).toMatchObject({ ok: true, duplicate: true });
    }
    db.conversation.findMany.mockResolvedValue([]);
    expect(await submitInquiry({ ...input, body: "A new question about parking?" }, c)).toMatchObject({
      ok: true,
      duplicate: false,
    });
  });

  it("caps duplicate re-sends per IP (looser cap, no DB hammering)", async () => {
    const c = ctx();
    db.conversation.findMany.mockResolvedValue([
      { id: "old", messages: [{ body: input.body }] },
    ]);
    for (let i = 0; i < INQUIRY_RATE_LIMITS.ipDuplicatesPer10Min; i++) {
      await submitInquiry(input, c);
    }
    expect(await submitInquiry(input, c)).toMatchObject({
      ok: false,
      status: 429,
      limit: { name: "ip_duplicates_per_10_minutes", max: 30, windowSeconds: 600 },
    });
  });

  it("limits one IP", async () => {
    const c = ctx();
    for (let i = 0; i < INQUIRY_RATE_LIMITS.ipPer10Min; i++) {
      db.conversation.findMany.mockResolvedValue([]);
      await submitInquiry({ ...input, body: `${input.body} ${i}` }, c);
    }
    const r = await submitInquiry(input, c);
    expect(r).toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
      limit: { name: "ip_per_10_minutes", max: 5, windowSeconds: 600 },
    });
    expect(r.ok === false && r.status === 429 && r.retryAfterSeconds).toBeGreaterThan(590);
    // The blocked attempt did not touch the database.
    expect(db.property.findFirst).toHaveBeenCalledTimes(INQUIRY_RATE_LIMITS.ipPer10Min);
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

describe("guest receipt details", () => {
  it("passes the trip and the saved message to the receipt", async () => {
    await submitInquiry(
      {
        ...input,
        trip: { checkIn: "2026-12-01", checkOut: "2026-12-04", guests: 3 },
      },
      ctx(),
    );
    expect(guestConfirm.sendGuestInquiryConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv1",
        message: input.body,
        trip: { checkIn: "2026-12-01", checkOut: "2026-12-04", guests: 3 },
      }),
    );
  });

  it("uses the booking's own dates when the sender owns the booking", async () => {
    db.booking.findUnique.mockResolvedValue({
      id: "b1",
      userId: null,
      guestEmail: "jo@example.com",
      propertyId: "p1",
      checkIn: new Date("2026-12-10T00:00:00Z"),
      checkOut: new Date("2026-12-12T00:00:00Z"),
      guests: 2,
      property: { hostId: "h1" },
    });
    await submitInquiry(
      {
        ...input,
        propertySlug: null,
        propertyId: "p1",
        bookingId: "b1",
        trip: { checkIn: "2027-01-01", checkOut: null, guests: 9 },
      },
      ctx({ source: "WEB" }),
    );
    expect(guestConfirm.sendGuestInquiryConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({
        trip: { checkIn: "2026-12-10", checkOut: "2026-12-12", guests: 2 },
      }),
    );
  });
});

describe("parseTrip", () => {
  it("keeps only valid values", () => {
    expect(parseTrip({})).toBeNull();
    expect(parseTrip({ checkIn: "12/01/2026", guests: "0" })).toBeNull();
    expect(parseTrip({ checkOut: "2026-12-04", guests: "2" })).toEqual({
      checkIn: null,
      checkOut: null,
      guests: 2,
    });
    expect(parseTrip({ checkIn: "2026-12-01", guests: 99 })).toEqual({
      checkIn: "2026-12-01",
      checkOut: null,
      guests: null,
    });
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
