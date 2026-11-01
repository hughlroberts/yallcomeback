import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";

const checkout = vi.hoisted(() => ({ createAgentStayCheckout: vi.fn() }));
vi.mock("@/lib/agent/checkout", () => checkout);

import { POST } from "./route";

function req(
  ip: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new NextRequest("https://www.yallcomeback.app/api/v1/stays/checkout", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": ip,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const body = (n: number) => ({
  slug: "kitchenette-1",
  checkIn: "2026-12-01",
  checkOut: "2026-12-03",
  guestName: "Guest",
  guestEmail: `guest${n}@example.com`,
  acceptTerms: true,
});

describe("public agent checkout route", () => {
  beforeAll(() => {
    vi.stubEnv("AGENT_API_ENABLED", "true");
    vi.stubEnv("AGENT_API_TOKEN", "");
  });
  afterAll(() => vi.unstubAllEnvs());
  beforeEach(() => {
    checkout.createAgentStayCheckout.mockReset();
    checkout.createAgentStayCheckout.mockResolvedValue({
      ok: true,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
      expiresAt: "2026-12-01T00:30:00.000Z",
      bookingId: "bk_1",
      quote: {},
    });
  });

  it("works with no Authorization header and no token configured", async () => {
    const res = await POST(req("203.0.113.1", body(1)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.checkoutUrl).toMatch(/checkout\.stripe\.com/);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("a 409 includes bookUrl (with the requested dates) for the guest", async () => {
    checkout.createAgentStayCheckout.mockResolvedValueOnce({
      ok: false,
      status: 409,
      error:
        "This listing is not ready to take a card deposit: the host has not finished Stripe card onboarding. Send the guest to bookUrl or have them message the host.",
    });
    const res = await POST(req("203.0.113.3", body(3)));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.bookUrl).toMatch(
      /\/book\/kitchenette-1\?checkIn=2026-12-01&checkOut=2026-12-03$/,
    );
  });

  it("a race-lost 409 (thrown) also includes bookUrl; other errors do not", async () => {
    checkout.createAgentStayCheckout.mockRejectedValueOnce(
      new Error("Dates not available"),
    );
    const lost = await POST(req("203.0.113.4", body(4)));
    expect(lost.status).toBe(409);
    expect((await lost.json()).bookUrl).toMatch(/\/book\/kitchenette-1/);
    checkout.createAgentStayCheckout.mockResolvedValueOnce({
      ok: false,
      status: 400,
      error: "guestName and guestEmail are required.",
    });
    const bad = await POST(req("203.0.113.5", body(5)));
    expect(bad.status).toBe(400);
    expect((await bad.json()).bookUrl).toBeUndefined();
  });

  it("ignores a stray bearer instead of rejecting it", async () => {
    const res = await POST(
      req("203.0.113.2", body(2), { authorization: "Bearer wrong" }),
    );
    expect(res.status).toBe(200);
  });

  it("rate limits per IP (10 per 15 minutes)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await POST(req("203.0.113.9", body(100 + i)))).status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(checkout.createAgentStayCheckout).toHaveBeenCalledTimes(10);
    // A different IP is not affected.
    expect((await POST(req("203.0.113.10", body(200)))).status).toBe(200);
  });

  it("passes the 409 for a host that is not card-ready", async () => {
    checkout.createAgentStayCheckout.mockResolvedValue({
      ok: false,
      status: 409,
      error:
        "This listing is not ready to take a card deposit: the host has not finished Stripe card onboarding.",
    });
    const res = await POST(req("203.0.113.3", body(3)));
    expect(res.status).toBe(409);
  });
});
