import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { dispatchPlatformEmail, resendRetryDelayMs } from "./messaging";

// Stubbed fetch only: nothing is sent anywhere, and no real key is used.
const ENV = { ...process.env };
beforeEach(() => {
  process.env.MESSAGING_EMAIL_ENABLED = "true";
  process.env.MESSAGING_EMAIL_FROM = "bookings@example.test";
  process.env.MESSAGING_EMAIL_API_KEY = "re_test_dummy";
  delete process.env.MESSAGING_EMAIL_DRY_RUN;
});
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

const resp = (
  status: number,
  body: object,
  headers: Record<string, string> = {},
) => new Response(JSON.stringify(body), { status, headers });

describe("Resend delivery", () => {
  it("retries a 429 (several host emails at once) and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        resp(429, { name: "rate_limit_exceeded" }, { "retry-after": "0.001" }),
      )
      .mockResolvedValueOnce(resp(200, { id: "email_1" }));
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await dispatchPlatformEmail({
      to: "host@example.test",
      subject: "New booking",
      text: "hi",
    });
    expect(r.status).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(
      /yallcomeback/,
    );
    warn.mockRestore();
  });

  it("does not retry a 4xx like an invalid recipient", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(resp(422, { message: "Invalid `to`" }));
    vi.stubGlobal("fetch", fetchMock);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await dispatchPlatformEmail({
      to: "host@example.test",
      subject: "x",
      text: "y",
    });
    expect(r.status).toBe("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    err.mockRestore();
  });

  it("uses retry-after, capped at 5s", () => {
    expect(resendRetryDelayMs(new Headers({ "retry-after": "2" }), 1)).toBe(
      2000,
    );
    expect(resendRetryDelayMs(new Headers({ "retry-after": "60" }), 1)).toBe(
      5000,
    );
    expect(resendRetryDelayMs(new Headers(), 2)).toBe(2000);
  });
});

describe("per-thread reply-to (reply by email)", () => {
  function enableInbound() {
    process.env.INBOUND_EMAIL_DOMAIN = "reply.example.test";
    process.env.INBOUND_EMAIL_TOKEN_SECRET = "test-secret-0123456789abcdef";
    process.env.RESEND_INBOUND_WEBHOOK_SECRET = "whsec_dGVzdA==";
  }
  const sentBody = (f: ReturnType<typeof vi.fn>) =>
    JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);

  it("booking mail keeps 'do not reply' when inbound is off", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    await dispatchPlatformEmail({
      to: "guest@example.test",
      subject: "Booked",
      text: "hi",
      replyTo: null,
    });
    const b = sentBody(fetchMock);
    expect(b.reply_to).toBeUndefined();
    expect(b.text).not.toContain("You can reply to this email");
  });

  it("booking mail invites a reply when given a thread address", async () => {
    enableInbound();
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { id: "e1" }));
    vi.stubGlobal("fetch", fetchMock);
    const { replyAddressFor } = await import("@/lib/inbound/reply-address");
    const addr = replyAddressFor("b", "cmbook12345", "GUEST")!;
    await dispatchPlatformEmail({
      to: "guest@example.test",
      subject: "Booked",
      text: "hi",
      replyTo: addr,
    });
    const b = sentBody(fetchMock);
    expect(b.reply_to).toEqual([addr]);
    expect(b.text).toContain("You can reply to this email");
  });
});
