import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/messaging", () => ({ dispatchEmail: vi.fn() }));
vi.mock("@/lib/host-recipients", () => ({ hostEmailRecipients: vi.fn() }));

import {
  DAILY_EMAIL_CAP,
  DIGEST_MINUTES,
  HEAVY_DIGEST_MINUTES,
  HEAVY_VOLUME_PER_HOUR,
  composeInquiryEmail,
  notifyDecision,
} from "./notify";

const now = new Date("2026-11-01T15:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("notifyDecision", () => {
  it("emails the first question right away", () => {
    expect(
      notifyDecision({
        now,
        lastEmailAt: null,
        dayStartedAt: null,
        emailsToday: 0,
        recentQuestions: 1,
      }),
    ).toMatchObject({ send: true, resetDay: true });
  });

  it("holds later questions for the digest window", () => {
    const d = notifyDecision({
      now,
      lastEmailAt: ago(5),
      dayStartedAt: ago(60),
      emailsToday: 1,
      recentQuestions: 2,
    });
    expect(d.send).toBe(false);
    expect(d.waitMs).toBe((DIGEST_MINUTES - 5) * 60_000);
    expect(
      notifyDecision({
        now,
        lastEmailAt: ago(DIGEST_MINUTES),
        dayStartedAt: ago(60),
        emailsToday: 1,
        recentQuestions: 2,
      }).send,
    ).toBe(true);
  });

  it("slows down under heavy volume", () => {
    const d = notifyDecision({
      now,
      lastEmailAt: ago(20),
      dayStartedAt: ago(60),
      emailsToday: 3,
      recentQuestions: HEAVY_VOLUME_PER_HOUR,
    });
    expect(d.send).toBe(false);
    expect(d.intervalMs).toBe(HEAVY_DIGEST_MINUTES * 60_000);
  });

  it("caps emails per day and resets after 24 hours", () => {
    expect(
      notifyDecision({
        now,
        lastEmailAt: ago(120),
        dayStartedAt: ago(600),
        emailsToday: DAILY_EMAIL_CAP,
        recentQuestions: 0,
      }).send,
    ).toBe(false);
    expect(
      notifyDecision({
        now,
        lastEmailAt: ago(120),
        dayStartedAt: ago(25 * 60),
        emailsToday: DAILY_EMAIL_CAP,
        recentQuestions: 0,
      }),
    ).toMatchObject({ send: true, resetDay: true });
  });
});

function msg(i: number, agent = false) {
  return {
    id: `m${i}`,
    body: `Question number ${i}?`,
    createdAt: now,
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
  it("sends one question with a direct reply link", () => {
    const e = composeInquiryEmail("Hugh", [msg(1)], 1);
    expect(e.single).toBe(true);
    expect(e.subject).toBe("New question · Lakefront");
    expect(e.replyPath).toBe("/admin/messages/c1");
    expect(e.body).toContain("Question number 1?");
  });

  it("groups several into a digest and labels AI-sent questions", () => {
    const e = composeInquiryEmail("Hugh", [msg(1), msg(2, true)], 5);
    expect(e.single).toBe(false);
    expect(e.subject).toBe("5 new guest questions · Hugh");
    expect(e.replyPath).toBe("/admin/messages");
    expect(e.body).toContain("sent by an AI assistant: TripBot");
    expect(e.body).toContain("…and 3 more in your inbox.");
  });
});
