import { describe, expect, it } from "vitest";
import { isSameOriginRequest, isSessionCookieName } from "@/lib/logout";

describe("isSessionCookieName", () => {
  it.each([
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "__Secure-authjs.session-token.0",
    "next-auth.session-token.1",
  ])("matches %s", (n) => expect(isSessionCookieName(n)).toBe(true));
  it.each(["authjs.csrf-token", "ycb_vid", "session-token"])(
    "skips %s",
    (n) => expect(isSessionCookieName(n)).toBe(false),
  );
});

describe("isSameOriginRequest", () => {
  const host = "www.yallcomeback.app";
  it("accepts our own origin", () => {
    expect(
      isSameOriginRequest({
        origin: "https://www.yallcomeback.app",
        secFetchSite: "same-origin",
        host,
      }),
    ).toBe(true);
  });
  it("rejects another origin", () => {
    expect(
      isSameOriginRequest({
        origin: "https://evil.example",
        secFetchSite: "cross-site",
        host,
      }),
    ).toBe(false);
  });
  it("falls back to Sec-Fetch-Site", () => {
    expect(
      isSameOriginRequest({ origin: null, secFetchSite: "same-origin", host }),
    ).toBe(true);
    expect(
      isSameOriginRequest({ origin: null, secFetchSite: null, host }),
    ).toBe(false);
  });
});
