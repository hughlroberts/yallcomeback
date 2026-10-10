import { describe, expect, it } from "vitest";
import {
  deviceTypeFromUserAgent,
  encodeUtmCookie,
  isBotUserAgent,
  isValidVisitorId,
  parseUtmCookie,
  parseUtmFromSearch,
  sanitizePath,
  sanitizeReferrer,
  sanitizeUtmToken,
  shouldSkipAnalyticsPath,
} from "@/lib/analytics-visitor";

describe("UTM parse", () => {
  it("reads source/medium/campaign from a landing URL", () => {
    const utm = parseUtmFromSearch(
      new URLSearchParams(
        "utm_source=twitter&utm_medium=social&utm_campaign=dock-photos",
      ),
    );
    expect(utm).toEqual({
      source: "twitter",
      medium: "social",
      campaign: "dock-photos",
    });
  });

  it("ignores URLs with no utm_source", () => {
    expect(parseUtmFromSearch(new URLSearchParams("ref=nav"))).toBeNull();
  });

  it("round-trips the first-touch cookie", () => {
    const utm = {
      source: "instagram",
      medium: "social",
      campaign: "spring",
    };
    expect(parseUtmCookie(encodeUtmCookie(utm))).toEqual(utm);
  });

  it("rejects unsafe UTM tokens", () => {
    expect(sanitizeUtmToken("twitter")).toBe("twitter");
    expect(sanitizeUtmToken("evil source")).toBeNull();
    expect(sanitizeUtmToken("https://x.com")).toBeNull();
  });
});

describe("visitor id", () => {
  it("accepts UUID v4", () => {
    expect(isValidVisitorId("2c1f6d2a-9b1e-4c3a-a111-0b2c3d4e5f60")).toBe(true);
    expect(isValidVisitorId("not-a-uuid")).toBe(false);
  });
});

describe("bots and admin paths", () => {
  it("skips common crawlers including GrokBot", () => {
    expect(isBotUserAgent("GrokBot/1.0")).toBe(true);
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
    ).toBe(false);
  });

  it("skips admin, ops, and API paths", () => {
    expect(shouldSkipAnalyticsPath("/admin/calendar")).toBe(true);
    expect(shouldSkipAnalyticsPath("/ops/settings/backups")).toBe(true);
    expect(shouldSkipAnalyticsPath("/api/v1/search")).toBe(true);
    expect(shouldSkipAnalyticsPath("/marketplace")).toBe(false);
    expect(shouldSkipAnalyticsPath("/for-hosts")).toBe(false);
  });
});

describe("device and referrer", () => {
  it("classifies phones vs desktop", () => {
    expect(
      deviceTypeFromUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
    ).toBe("mobile");
    expect(
      deviceTypeFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      ),
    ).toBe("desktop");
  });

  it("strips query strings from referrers", () => {
    expect(
      sanitizeReferrer("https://t.co/abc?s=token"),
    ).toBe("https://t.co/abc");
    expect(sanitizeReferrer("javascript:alert(1)")).toBeNull();
  });

  it("only allows relative paths", () => {
    expect(sanitizePath("/marketplace/properties/x")).toBe(
      "/marketplace/properties/x",
    );
    expect(sanitizePath("https://evil.example/")).toBeNull();
    expect(sanitizePath("//evil.example")).toBeNull();
  });
});
