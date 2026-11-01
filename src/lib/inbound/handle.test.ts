import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  message: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  conversation: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  booking: { findUnique: vi.fn() },
  user: { findFirst: vi.fn() },
}));
const delivery = vi.hoisted(() => ({
  deliverGuestMessageToHosts: vi.fn(),
  deliverHostMessageToGuest: vi.fn(),
}));
const parseReplyAddress = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/conversation-delivery", () => delivery);
vi.mock("./reply-address", () => ({ parseReplyAddress }));

import { handleInboundEmail, isAutoReply } from "./handle";
import type { ReceivedEmail } from "./resend-receiving";

const THREAD_ADDR = "reply+c-g-conv1-abc@reply.test";

let n = 0;
function email(over: Partial<ReceivedEmail> = {}): ReceivedEmail {
  n += 1;
  return {
    id: `email-${n}`,
    from: "Guest One <guest@example.com>",
    to: [`Lakefront <${THREAD_ADDR}>`],
    subject: "Re: Message from Lakefront",
    text: "Can we bring our dog?\n\nOn Sun, Nov 1 Lakefront wrote:\n> hi",
    authentication: { spf: "pass", dkim: "pass", dmarc: "pass" },
    headers: {},
    ...over,
  };
}

const thread = {
  id: "conv1",
  hostId: "h1",
  guestName: "Guest One",
  guestEmail: "guest@example.com",
  guestPhone: null,
  guestUserId: null,
  guestUser: null,
  booking: null,
  host: {
    id: "h1",
    name: "Lakefront",
    contactEmail: "host@lakefront.test",
    billingEmail: null,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  parseReplyAddress.mockImplementation((a: string) =>
    a === THREAD_ADDR
      ? { kind: "c", role: "GUEST", id: "conv1" }
      : a === "reply+c-h-conv1-abc@reply.test"
        ? { kind: "c", role: "HOST", id: "conv1" }
        : null,
  );
  db.message.findUnique.mockResolvedValue(null);
  db.message.findFirst.mockResolvedValue(null);
  db.message.create.mockResolvedValue({ id: "msg-new" });
  db.conversation.findUnique.mockResolvedValue(thread);
  db.user.findFirst.mockResolvedValue(null);
});

describe("handleInboundEmail", () => {
  it("adds a guest reply (quote stripped) and emails the hosts", async () => {
    const r = await handleInboundEmail(email());
    expect(r).toEqual({
      status: "added",
      conversationId: "conv1",
      messageId: "msg-new",
    });
    expect(db.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationId: "conv1",
          senderRole: "GUEST",
          body: "Can we bring our dog?",
          channel: "EMAIL",
          hostNotifyPending: true,
        }),
      }),
    );
    expect(db.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "OPEN" }),
      }),
    );
    expect(delivery.deliverGuestMessageToHosts).toHaveBeenCalledWith("h1");
  });

  it("adds a host reply and emails the guest", async () => {
    const r = await handleInboundEmail(
      email({
        from: "host@lakefront.test",
        to: ["reply+c-h-conv1-abc@reply.test"],
        text: "Yes, dogs are welcome.",
      }),
    );
    expect(r.status).toBe("added");
    expect(delivery.deliverHostMessageToGuest).toHaveBeenCalledWith(
      thread,
      "msg-new",
      "Yes, dogs are welcome.",
    );
    expect(delivery.deliverGuestMessageToHosts).not.toHaveBeenCalled();
  });

  it("finds the thread address in received_for when To is something else", async () => {
    const r = await handleInboundEmail(
      email({ to: ["someone@else.test"], received_for: [THREAD_ADDR] }),
    );
    expect(r.status).toBe("added");
  });

  it("ignores mail from someone not on the thread", async () => {
    const r = await handleInboundEmail(email({ from: "stranger@evil.test" }));
    expect(r).toEqual({ status: "ignored", reason: "sender_not_on_thread" });
    expect(db.message.create).not.toHaveBeenCalled();
  });

  it("ignores failed DMARC, auto-replies, bad tokens and repeats", async () => {
    expect(
      (await handleInboundEmail(email({ authentication: { dmarc: "fail" } })))
        .status,
    ).toBe("ignored");
    expect(
      await handleInboundEmail(
        email({ headers: { "Auto-Submitted": "auto-replied" } }),
      ),
    ).toEqual({ status: "ignored", reason: "auto_reply" });
    expect(
      await handleInboundEmail(
        email({ to: ["reply+c-g-conv1-forged@reply.test"] }),
      ),
    ).toEqual({ status: "ignored", reason: "no_thread_address" });
    db.message.findUnique.mockResolvedValueOnce({ id: "old" });
    expect(await handleInboundEmail(email())).toEqual({
      status: "ignored",
      reason: "already_added",
    });
    db.message.findFirst.mockResolvedValueOnce({
      body: "Can we bring our dog?",
    });
    expect(await handleInboundEmail(email())).toEqual({
      status: "ignored",
      reason: "duplicate",
    });
    expect(db.message.create).not.toHaveBeenCalled();
  });

  it("applies the spam filter to guest replies", async () => {
    const r = await handleInboundEmail(
      email({ text: "Cheap SEO backlinks and crypto, click here" }),
    );
    expect(r.status).toBe("ignored");
    expect(db.message.create).not.toHaveBeenCalled();
  });

  it("starts the booking thread for a reply to a booking email", async () => {
    parseReplyAddress.mockReturnValue({ kind: "b", role: "GUEST", id: "bk1" });
    db.booking.findUnique.mockResolvedValue({
      id: "bk1",
      userId: null,
      guestName: "Guest One",
      guestEmail: "guest@example.com",
      guestPhone: null,
      property: { id: "p1", hostId: "h1", title: "Lakefront" },
      conversations: [],
    });
    db.conversation.create.mockResolvedValue({ id: "conv1" });
    const r = await handleInboundEmail(
      email({ text: "What is the door code?" }),
    );
    expect(r.status).toBe("added");
    expect(db.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bookingId: "bk1", hostId: "h1" }),
      }),
    );
  });

  it("rate-limits one sender", async () => {
    db.conversation.findUnique.mockResolvedValue({
      ...thread,
      guestEmail: "flood@example.com",
    });
    const results = [];
    for (let i = 0; i < 22; i++) {
      results.push(
        await handleInboundEmail(
          email({
            from: "flood@example.com",
            text: `Note ${i} about parking spot ${i}`,
          }),
        ),
      );
    }
    expect(results.at(-1)).toEqual({
      status: "ignored",
      reason: "rate_limited",
    });
  });
});

describe("isAutoReply", () => {
  it("spots out-of-office and bounce mail", () => {
    expect(isAutoReply(email({ headers: { precedence: "auto_reply" } }))).toBe(
      true,
    );
    expect(isAutoReply(email({ from: "MAILER-DAEMON@mx.test" }))).toBe(true);
    expect(isAutoReply(email({ headers: { "auto-submitted": "no" } }))).toBe(
      false,
    );
  });
});
