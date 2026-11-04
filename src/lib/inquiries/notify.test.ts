import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  message: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  host: { findUnique: vi.fn() },
  inquiryNotifyState: { upsert: vi.fn(), updateMany: vi.fn() },
  conversation: { findMany: vi.fn() },
}));
const dispatchEmail = vi.hoisted(() => vi.fn());
const hostEmailRecipients = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/messaging", () => ({ dispatchEmail }));
vi.mock("@/lib/host-recipients", () => ({
  hostEmailRecipients,
  maskEmail: (e: string) => `${e.slice(0, 2)}***@${e.split("@")[1]}`,
}));

import {
  DAILY_EMAIL_CAP,
  FLOOD_INSTANT_MAX,
  FLOOD_WINDOW_MINUTES,
  NOTIFY_RETRY_HOURS,
  composeInquiryEmail,
  flushHostInquiryEmails,
  hostSendOutcome,
  notifyDecision,
} from "./notify";

const now = new Date("2026-11-01T15:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("notifyDecision", () => {
  it("emails every message right away while under the flood limit", () => {
    expect(
      notifyDecision({
        now,
        windowStartedAt: null,
        windowCount: 0,
        dayStartedAt: null,
        emailsToday: 0,
      }),
    ).toMatchObject({ send: true, resetDay: true, resetWindow: true });
    for (let n = 1; n < FLOOD_INSTANT_MAX; n++) {
      expect(
        notifyDecision({
          now,
          windowStartedAt: ago(1),
          windowCount: n,
          dayStartedAt: ago(60),
          emailsToday: n,
        }),
      ).toMatchObject({ send: true, resetWindow: false });
    }
  });

  it("holds messages after 10 emails in 10 minutes until the window ends", () => {
    const d = notifyDecision({
      now,
      windowStartedAt: ago(4),
      windowCount: FLOOD_INSTANT_MAX,
      dayStartedAt: ago(60),
      emailsToday: 12,
    });
    expect(d).toMatchObject({ send: false, reason: "flood" });
    expect(d.waitMs).toBe((FLOOD_WINDOW_MINUTES - 4) * 60_000);
    // Window over: the digest goes out and starts a fresh window.
    expect(
      notifyDecision({
        now,
        windowStartedAt: ago(FLOOD_WINDOW_MINUTES),
        windowCount: FLOOD_INSTANT_MAX + 5,
        dayStartedAt: ago(60),
        emailsToday: 12,
      }),
    ).toMatchObject({ send: true, resetWindow: true });
  });

  it("holds at the daily safety cap and resets after 24 hours", () => {
    expect(
      notifyDecision({
        now,
        windowStartedAt: ago(120),
        windowCount: 1,
        dayStartedAt: ago(600),
        emailsToday: DAILY_EMAIL_CAP,
      }),
    ).toMatchObject({ send: false, reason: "daily_cap" });
    expect(
      notifyDecision({
        now,
        windowStartedAt: ago(120),
        windowCount: 1,
        dayStartedAt: ago(25 * 60),
        emailsToday: DAILY_EMAIL_CAP,
      }),
    ).toMatchObject({ send: true, resetDay: true });
    expect(DAILY_EMAIL_CAP).toBe(200);
  });
});

function msg(i: number, agent = false, isReply = false) {
  return {
    id: `m${i}`,
    body: `Question number ${i}?`,
    createdAt: now,
    isReply,
    conversation: {
      id: `c${i}`,
      guestName: `Guest ${i}`,
      guestEmail: `g${i}@example.com`,
      inquirySource: agent ? "AGENT" : "WEB",
      inquiryAgent: agent ? "TripBot" : null,
      property: { title: "Lakefront" },
    },
  };
}

describe("composeInquiryEmail", () => {
  it("sends one new question with a direct reply link", () => {
    const e = composeInquiryEmail("Hugh", [msg(1)], 1);
    expect(e.single).toBe(true);
    expect(e.subject).toBe("New question · Lakefront");
    expect(e.replyPath).toBe("/admin/messages/c1");
    expect(e.body).toContain("Question number 1?");
    expect(e.body).not.toMatch(/minutes/);
  });

  it("labels a guest reply in an existing thread", () => {
    const e = composeInquiryEmail("Hugh", [msg(1, false, true)], 1);
    expect(e.subject).toBe("Guest reply · Lakefront");
    expect(e.body).toBe("Guest 1 wrote:\n\nQuestion number 1?");
  });

  it("groups a flood into one digest and labels AI-sent questions", () => {
    const e = composeInquiryEmail("Hugh", [msg(1), msg(2, true)], 5);
    expect(e.single).toBe(false);
    expect(e.subject).toBe("5 new guest messages · Hugh");
    expect(e.replyPath).toBe("/admin/messages");
    expect(e.body).toContain("sent by an AI assistant: TripBot");
    expect(e.body).toContain("…and 3 more in your inbox.");
    expect(e.body).toContain("grouped into one email");
  });
});

function row(i: number, firstId: string) {
  const m = msg(i);
  return {
    id: m.id,
    body: m.body,
    createdAt: now,
    conversation: { ...m.conversation, messages: [{ id: firstId }] },
  };
}

describe("flushHostInquiryEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.host.findUnique.mockResolvedValue({ id: "h1", name: "Hugh" });
    db.message.count.mockResolvedValue(1);
    db.message.updateMany.mockResolvedValue({ count: 1 });
    db.inquiryNotifyState.updateMany.mockResolvedValue({ count: 1 });
    hostEmailRecipients.mockResolvedValue(["host@x.com", "cohost@x.com"]);
    dispatchEmail.mockResolvedValue({ attempted: true, status: "sent" });
  });

  it("emails hosts and co-hosts at once for a guest reply", async () => {
    db.inquiryNotifyState.upsert.mockResolvedValue({
      hostId: "h1",
      windowStartedAt: ago(2),
      windowCount: 3,
      dayStartedAt: ago(60),
      emailsToday: 3,
    });
    db.message.findMany.mockResolvedValue([row(1, "first-msg")]);
    await expect(flushHostInquiryEmails("h1", now)).resolves.toBe("emailed");
    expect(dispatchEmail).toHaveBeenCalledTimes(2);
    expect(dispatchEmail.mock.calls[0][0]).toMatchObject({
      to: "host@x.com",
      subject: "Guest reply · Lakefront",
      threadRole: "HOST",
    });
    // One recipient per email, and no guest address in a header.
    const sent = dispatchEmail.mock.calls.map((c) => c[0]);
    expect(sent.map((o) => o.to)).toEqual(["host@x.com", expect.any(String)]);
    expect(new Set(sent.map((o) => o.to)).size).toBe(2);
    for (const o of sent) {
      expect(typeof o.to).toBe("string");
      expect(o).not.toHaveProperty("replyTo");
    }
    expect(db.inquiryNotifyState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ windowCount: { increment: 1 } }),
      }),
    );
  });

  it("queues during a flood and does not email", async () => {
    db.inquiryNotifyState.upsert.mockResolvedValue({
      hostId: "h1",
      windowStartedAt: ago(3),
      windowCount: FLOOD_INSTANT_MAX,
      dayStartedAt: ago(60),
      emailsToday: FLOOD_INSTANT_MAX,
    });
    await expect(flushHostInquiryEmails("h1", now)).resolves.toBe("queued");
    expect(dispatchEmail).not.toHaveBeenCalled();
  });

  it("logs and holds over the daily cap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    db.inquiryNotifyState.upsert.mockResolvedValue({
      hostId: "h1",
      windowStartedAt: ago(30),
      windowCount: 1,
      dayStartedAt: ago(600),
      emailsToday: DAILY_EMAIL_CAP,
    });
    await expect(flushHostInquiryEmails("h1", now)).resolves.toBe("queued");
    expect(warn).toHaveBeenCalledWith(
      "[inquiry-notify:daily-cap]",
      expect.objectContaining({ hostId: "h1", cap: DAILY_EMAIL_CAP }),
    );
    expect(dispatchEmail).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sends a held flood as one digest without a thread reply-to", async () => {
    db.message.count.mockResolvedValue(3);
    db.inquiryNotifyState.upsert.mockResolvedValue({
      hostId: "h1",
      windowStartedAt: ago(FLOOD_WINDOW_MINUTES + 1),
      windowCount: FLOOD_INSTANT_MAX,
      dayStartedAt: ago(60),
      emailsToday: FLOOD_INSTANT_MAX,
    });
    db.message.findMany.mockResolvedValue([
      row(1, "m1"),
      row(2, "m2"),
      row(3, "m3"),
    ]);
    db.message.updateMany.mockResolvedValue({ count: 3 });
    await flushHostInquiryEmails("h1", now);
    expect(dispatchEmail.mock.calls[0][0]).toMatchObject({
      subject: "3 new guest messages · Hugh",
      threadRole: undefined,
    });
    expect(dispatchEmail.mock.calls[0][0]).not.toHaveProperty("replyTo");
    expect(db.inquiryNotifyState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ windowCount: 1 }),
      }),
    );
  });
});

describe("host email failures are not swallowed (#7)", () => {
  const fresh = () => ({
    hostId: "h1",
    windowStartedAt: ago(2),
    windowCount: 1,
    dayStartedAt: ago(60),
    emailsToday: 1,
  });
  beforeEach(() => {
    vi.clearAllMocks();
    db.host.findUnique.mockResolvedValue({ id: "h1", name: "Hugh" });
    db.message.count.mockResolvedValue(1);
    db.message.updateMany.mockResolvedValue({ count: 1 });
    db.inquiryNotifyState.updateMany.mockResolvedValue({ count: 1 });
    db.inquiryNotifyState.upsert.mockResolvedValue(fresh());
    db.message.findMany.mockResolvedValue([row(1, "m1")]);
    hostEmailRecipients.mockResolvedValue(["host@x.com", "cohost@x.com"]);
  });

  it("hostSendOutcome: emailed if any sent, retry if all failed, none otherwise", () => {
    expect(hostSendOutcome([{ status: "failed" }, { status: "sent" }])).toBe("emailed");
    expect(hostSendOutcome([{ status: "failed" }, { status: "not_configured" }])).toBe("retry");
    expect(hostSendOutcome([{ status: "skipped" }])).toBe("none");
    expect(hostSendOutcome([])).toBe("none");
  });

  it("puts the message back for the cron and reports queued when every send fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    dispatchEmail.mockResolvedValue({
      attempted: true,
      status: "failed",
      detail: "The example.com domain is not verified",
    });
    await expect(flushHostInquiryEmails("h1", now)).resolves.toBe("queued");
    expect(db.message.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1"] } },
      data: { hostNotifyPending: true },
    });
    // The failed attempt gives back its flood/daily slot.
    expect(db.inquiryNotifyState.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { emailsToday: { decrement: 1 }, windowCount: { decrement: 1 } },
      }),
    );
    const line = warn.mock.calls.find((c) => c[0] === "[inquiry-notify]")?.[1];
    expect(line).toMatchObject({ hostId: "h1", conversationId: "c1", outcome: "retry" });
    const logged = JSON.stringify(line);
    expect(logged).toContain("ho***@x.com=failed(The example.com domain is not verified)");
    expect(logged).not.toContain("host@x.com");
    expect(logged).not.toContain("Question number 1?");
    warn.mockRestore();
  });

  it("does not retry messages older than the retry window", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    dispatchEmail.mockResolvedValue({ attempted: false, status: "not_configured", detail: "No email transport" });
    const old = row(1, "m1");
    old.createdAt = new Date(now.getTime() - (NOTIFY_RETRY_HOURS + 1) * 3_600_000);
    db.message.findMany.mockResolvedValue([old]);
    await flushHostInquiryEmails("h1", now);
    expect(db.message.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { hostNotifyPending: true } }),
    );
    warn.mockRestore();
  });

  it("reports emailed and logs info when one recipient gets it", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    dispatchEmail
      .mockResolvedValueOnce({ attempted: true, status: "failed", detail: "x" })
      .mockResolvedValueOnce({ attempted: true, status: "sent" });
    await expect(flushHostInquiryEmails("h1", now)).resolves.toBe("emailed");
    expect(db.message.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { hostNotifyPending: true } }),
    );
    expect(info).toHaveBeenCalledWith(
      "[inquiry-notify]",
      expect.objectContaining({ outcome: "emailed" }),
    );
    info.mockRestore();
  });

  it("returns none and marks the message when the brand has no host email", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hostEmailRecipients.mockResolvedValue([]);
    await expect(flushHostInquiryEmails("h1", now)).resolves.toBe("none");
    expect(dispatchEmail).not.toHaveBeenCalled();
    expect(db.message.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1"] } },
      data: { externalStatus: "email:no_host_recipients", externalId: null },
    });
    warn.mockRestore();
  });
});
