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
