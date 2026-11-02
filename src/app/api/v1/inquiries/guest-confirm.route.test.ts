/**
 * API (agent) inquiries send the guest the same receipt as the listing page
 * form: the real route → submitInquiry → sendGuestInquiryConfirmation path,
 * with only the database and the mail sender mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  property: { findFirst: vi.fn() },
  host: { findUnique: vi.fn() },
  booking: { findUnique: vi.fn() },
  conversation: {
    findMany: vi.fn(async () => []),
    count: vi.fn<(args: { where: Record<string, unknown> }) => Promise<number>>(async () => 0),
    create: vi.fn(async () => ({ id: "conv_api" })),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
}));
const mail = vi.hoisted(() => ({
  dispatchPlatformEmail: vi.fn<
    (m: { to: string; subject: string; text: string }) => Promise<{ status: string; detail: string }>
  >(async () => ({ status: "sent", detail: "" })),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/agent/guard", () => ({ agentApiDisabledResponse: () => null }));
vi.mock("@/lib/host", () => ({
  marketplacePropertyWhere: () => ({ published: true, onMarketplace: true }),
}));
vi.mock("@/lib/inquiries/notify", () => ({
  flushHostInquiryEmails: vi.fn(async () => "emailed"),
}));
vi.mock("@/lib/messaging", () => mail);
vi.mock("@/lib/notification-prefs", () => ({ canSendEmailTo: vi.fn(async () => true) }));

import { NextRequest } from "next/server";
import { POST } from "./route";

let ip = 0;
const post = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("https://www.yallcomeback.app/api/v1/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": `10.9.0.${++ip}` },
      body: JSON.stringify(body),
    }),
  );
const ask = {
  slug: "lakefront",
  guestName: "Jo Guest",
  guestEmail: "Jo@Example.com",
  message: "Is the dock deep enough for a pontoon boat?",
  agentName: "TripBot",
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
  db.conversation.count.mockResolvedValue(0);
});

describe("API inquiry guest receipt", () => {
  it("emails the guest the receipt once (fixed wording, no sender text)", async () => {
    const res = await post(ask);
    expect(res.status).toBe(201);
    expect(mail.dispatchPlatformEmail).toHaveBeenCalledTimes(1);
    const sent = mail.dispatchPlatformEmail.mock.calls[0]![0];
    expect(sent.to).toBe("jo@example.com");
    expect(sent.subject).toBe("We sent your question to Hugh");
    expect(sent.text).toContain("Lakefront");
    expect(sent.text).not.toContain("pontoon");
    expect(db.conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "conv_api", guestConfirmSentAt: null } }),
    );
  });

  it("respects the per-address receipt cap", async () => {
    db.conversation.count.mockImplementation(async ({ where }) =>
      "guestConfirmSentAt" in where ? 1 : 0,
    );
    const res = await post(ask);
    expect(res.status).toBe(201);
    expect(mail.dispatchPlatformEmail).not.toHaveBeenCalled();
  });

  it("no guest email: rejected, nothing sent", async () => {
    const res = await post({ ...ask, guestEmail: "" });
    expect(res.status).toBe(400);
    expect(db.conversation.create).not.toHaveBeenCalled();
    expect(mail.dispatchPlatformEmail).not.toHaveBeenCalled();
  });

  it("repeat question: no second receipt", async () => {
    db.conversation.findMany.mockResolvedValueOnce([
      { id: "old", messages: [{ body: ask.message }] },
    ] as never);
    const res = await post(ask);
    expect(res.status).toBe(200);
    expect(mail.dispatchPlatformEmail).not.toHaveBeenCalled();
  });
});
