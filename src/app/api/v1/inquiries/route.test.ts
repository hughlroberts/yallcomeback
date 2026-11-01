import { beforeEach, describe, expect, it, vi } from "vitest";

const submit = vi.hoisted(() => ({ submitInquiry: vi.fn() }));
vi.mock("@/lib/agent/guard", () => ({ agentApiDisabledResponse: () => null }));
vi.mock("@/lib/inquiries/submit", async (orig) => ({
  ...(await orig<typeof import("@/lib/inquiries/submit")>()),
  submitInquiry: submit.submitInquiry,
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/inquiries/notify", () => ({ flushHostInquiryEmails: vi.fn() }));

import { NextRequest } from "next/server";
import { OPTIONS, POST } from "./route";

const req = (body: unknown) =>
  new NextRequest("https://www.yallcomeback.app/api/v1/inquiries", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "1.2.3.4" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe("POST /api/v1/inquiries", () => {
  it("sends an agent question and returns 201", async () => {
    submit.submitInquiry.mockResolvedValue({
      ok: true,
      conversationId: "c1",
      duplicate: false,
      hostNotification: "emailed",
    });
    const res = await POST(
      req({
        slug: "lakefront",
        guestName: "Jo",
        guestEmail: "jo@example.com",
        message: "Dogs OK?",
        checkIn: "2026-12-08",
        checkOut: "2026-12-10",
        guests: 2,
        agentName: "TripBot",
      }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toMatchObject({
      ok: true,
      inquiryId: "c1",
      duplicate: false,
      hostNotification: "emailed",
    });
    const [input, ctx] = submit.submitInquiry.mock.calls[0]!;
    expect(input).toMatchObject({
      propertySlug: "lakefront",
      guestEmail: "jo@example.com",
    });
    expect(input.body).toBe(
      "Dates: 2026-12-08 to 2026-12-10 · Guests: 2\n\nDogs OK?",
    );
    expect(ctx).toMatchObject({ source: "AGENT", agentName: "TripBot" });
  });

  it("returns 200 for a duplicate", async () => {
    submit.submitInquiry.mockResolvedValue({
      ok: true,
      conversationId: "c1",
      duplicate: true,
      hostNotification: "none",
    });
    const res = await POST(
      req({
        slug: "x",
        guestName: "Jo",
        guestEmail: "jo@example.com",
        message: "Dogs OK?",
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
  });

  it("passes through errors with their status and code", async () => {
    submit.submitInquiry.mockResolvedValue({
      ok: false,
      status: 429,
      code: "rate_limited",
      error: "Too many",
    });
    const res = await POST(
      req({
        slug: "x",
        guestName: "Jo",
        guestEmail: "jo@example.com",
        message: "hello there",
      }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      ok: false,
      code: "rate_limited",
      error: "Too many",
    });
  });

  it("400s bad JSON or a missing slug", async () => {
    expect((await POST(req("{nope"))).status).toBe(400);
    expect((await POST(req({ message: "hi" }))).status).toBe(400);
    expect(submit.submitInquiry).not.toHaveBeenCalled();
  });

  it("answers CORS preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
