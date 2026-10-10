import { afterEach, describe, expect, it } from "vitest";
import { analyticsUnauthorized } from "@/lib/analytics-auth";

describe("analyticsUnauthorized", () => {
  const prev = process.env.ANALYTICS_API_TOKEN;

  afterEach(() => {
    if (prev === undefined) delete process.env.ANALYTICS_API_TOKEN;
    else process.env.ANALYTICS_API_TOKEN = prev;
  });

  it("fails closed when the token is missing", () => {
    delete process.env.ANALYTICS_API_TOKEN;
    const res = analyticsUnauthorized(
      new Request("https://www.yallcomeback.app/api/admin/stats"),
    );
    expect(res?.status).toBe(503);
  });

  it("rejects a bad bearer", () => {
    process.env.ANALYTICS_API_TOKEN = "test-analytics-token";
    const res = analyticsUnauthorized(
      new Request("https://www.yallcomeback.app/api/admin/stats", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(res?.status).toBe(401);
  });

  it("allows the matching bearer", () => {
    process.env.ANALYTICS_API_TOKEN = "test-analytics-token";
    const res = analyticsUnauthorized(
      new Request("https://www.yallcomeback.app/api/admin/stats", {
        headers: { authorization: "Bearer test-analytics-token" },
      }),
    );
    expect(res).toBeNull();
  });
});
