import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordPageView: vi.fn(async () => ({ ok: true as const })),
  recordSignupStartedOnce: vi.fn(async () => {}),
  actorIsInternal: vi.fn(async () => false),
  trackAnalyticsEvent: vi.fn(),
  recordPropertyView: vi.fn(async () => {}),
  findFirst: vi.fn(async () => ({ id: "p1", slug: "lake-house" })),
}));
vi.mock("@/lib/analytics", () => ({
  recordPageView: mocks.recordPageView,
  recordSignupStartedOnce: mocks.recordSignupStartedOnce,
  actorIsInternal: mocks.actorIsInternal,
  trackAnalyticsEvent: mocks.trackAnalyticsEvent,
}));
vi.mock("@/lib/listing-insights", () => ({ recordPropertyView: mocks.recordPropertyView }));
vi.mock("@/lib/db", () => ({ prisma: { property: { findFirst: mocks.findFirst } } }));
vi.mock("@/lib/rate-limit", () => ({
  incomingIpFromRequest: () => "1.2.3.4",
  rateLimitAllow: () => true,
}));

import { POST as pageview } from "./pageview/route";
import { POST as event } from "./event/route";
import { POST as listingViews } from "../listing-views/route";

function post(url: string, body: unknown, cookie?: string) {
  return new Request(`https://www.yallcomeback.app${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe("tracking endpoints honor ycb_internal server-side", () => {
  it("pageview: skips with the cookie, records without it", async () => {
    const skipped = await pageview(post("/api/analytics/pageview", { path: "/" }, "ycb_internal=1"));
    expect(await skipped.json()).toEqual({ ok: true, skipped: "internal" });
    expect(mocks.recordPageView).not.toHaveBeenCalled();

    await pageview(post("/api/analytics/pageview", { path: "/" }));
    expect(mocks.recordPageView).toHaveBeenCalledTimes(1);
  });

  it("event: skips with the cookie", async () => {
    const res = await event(
      post("/api/analytics/event", { name: "guest_signup_started" }, "a=b; ycb_internal=1"),
    );
    expect(await res.json()).toEqual({ ok: true, skipped: "internal" });
    expect(mocks.recordSignupStartedOnce).not.toHaveBeenCalled();
  });

  it("listing views: skips with the cookie or for an internal signed-in user", async () => {
    await listingViews(post("/api/listing-views", { propertyId: "p1" }, "ycb_internal=1"));
    mocks.actorIsInternal.mockResolvedValueOnce(true);
    await listingViews(post("/api/listing-views", { propertyId: "p1" }));
    expect(mocks.recordPropertyView).not.toHaveBeenCalled();
    expect(mocks.trackAnalyticsEvent).not.toHaveBeenCalled();

    await listingViews(post("/api/listing-views", { propertyId: "p1" }));
    expect(mocks.recordPropertyView).toHaveBeenCalledTimes(1);
    expect(mocks.trackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });
});
