import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({
  recordPageView: vi.fn(async () => ({ ok: true })),
  recordSignupStartedOnce: vi.fn(async () => {}),
  actorIsInternal: vi.fn(async () => false),
  trackAnalyticsEvent: vi.fn(),
}));
vi.mock("@/lib/listing-insights", () => ({ recordPropertyView: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { property: { findFirst: vi.fn(async () => null) } } }));
vi.mock("@/lib/rate-limit", () => ({
  incomingIpFromRequest: () => "1.2.3.4",
  rateLimitAllow: () => true,
}));

import { POST as pageview } from "./pageview/route";
import { POST as event } from "./event/route";
import { POST as listingViews } from "../listing-views/route";

const post = (body: string) =>
  new Request("https://www.yallcomeback.app/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

describe("tracking endpoints reject non-object JSON with 400, not 500", () => {
  for (const raw of ["null", "[]", "42", '"x"']) {
    it(`body ${raw}`, async () => {
      expect((await pageview(post(raw))).status).toBe(400);
      expect((await event(post(raw))).status).toBe(400);
      expect((await listingViews(post(raw))).status).toBe(400);
    });
  }
  it("non-string fields are rejected cleanly", async () => {
    expect((await listingViews(post('{"propertyId":5}'))).status).toBe(400);
    expect((await event(post('{"name":{}}'))).status).toBe(400);
  });
});
