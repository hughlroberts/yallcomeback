import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  INTERNAL_COOKIE,
  applyInternalCookie,
  hasInternalCookieHeader,
  isExcludedEmail,
  isInternalAccount,
  isStaffRole,
  parseExcludedEmails,
  requestIsInternal,
} from "@/lib/analytics-internal";
import { applyVisitorCookies } from "@/lib/analytics-visitor";

afterEach(() => vi.unstubAllEnvs());

describe("ANALYTICS_EXCLUDE_EMAILS", () => {
  it("splits on commas, trims, lowercases, and drops blanks", () => {
    expect(parseExcludedEmails(" Hugh@Example.com ,, tester@x.io ,")).toEqual([
      "hugh@example.com",
      "tester@x.io",
    ]);
    expect(parseExcludedEmails("")).toEqual([]);
    expect(parseExcludedEmails(undefined)).toEqual([]);
  });

  it("matches case-insensitively from the env var", () => {
    vi.stubEnv("ANALYTICS_EXCLUDE_EMAILS", "Hugh@Example.com, a@b.co");
    expect(isExcludedEmail("hugh@example.COM")).toBe(true);
    expect(isExcludedEmail(" a@b.co ")).toBe(true);
    expect(isExcludedEmail("guest@example.com")).toBe(false);
    expect(isExcludedEmail(null)).toBe(false);
  });

  it("treats flagged or excluded accounts as internal", () => {
    vi.stubEnv("ANALYTICS_EXCLUDE_EMAILS", "team@x.io");
    expect(isInternalAccount({ isInternal: true, email: "g@x.io" })).toBe(true);
    expect(isInternalAccount({ isInternal: false, email: "TEAM@x.io" })).toBe(true);
    expect(isInternalAccount({ isInternal: false, email: "g@x.io" })).toBe(false);
  });

  it("staff roles are ADMIN and HOST only", () => {
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("HOST")).toBe(true);
    expect(isStaffRole("GUEST")).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});

describe("ycb_internal cookie", () => {
  it("reads the cookie from a raw header", () => {
    expect(hasInternalCookieHeader("a=1; ycb_internal=1; b=2")).toBe(true);
    expect(hasInternalCookieHeader("ycb_internal=0")).toBe(false);
    expect(hasInternalCookieHeader("xycb_internal=1")).toBe(false);
    expect(hasInternalCookieHeader(null)).toBe(false);
  });

  it("?ycb_test=1 sets a 1-year, path /, Lax cookie the tracker can read", () => {
    const req = new NextRequest("https://www.yallcomeback.app/?ycb_test=1");
    const res = applyInternalCookie(req, NextResponse.next());
    const c = res.cookies.get(INTERNAL_COOKIE);
    expect(c?.value).toBe("1");
    expect(c?.path).toBe("/");
    expect(c?.maxAge).toBe(60 * 60 * 24 * 365);
    expect(String(c?.sameSite).toLowerCase()).toBe("lax");
    expect(c?.httpOnly).toBe(false);
    expect(requestIsInternal(req)).toBe(true);
  });

  it("is Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new NextRequest("https://www.yallcomeback.app/x?ycb_test=1");
    const res = applyInternalCookie(req, NextResponse.next());
    expect(res.cookies.get(INTERNAL_COOKIE)?.secure).toBe(true);
  });

  it("?ycb_test=0 clears it", () => {
    const req = new NextRequest("https://www.yallcomeback.app/?ycb_test=0", {
      headers: { cookie: "ycb_internal=1" },
    });
    const res = applyInternalCookie(req, NextResponse.next());
    const c = res.cookies.get(INTERNAL_COOKIE);
    expect(c?.value).toBe("");
    expect(c?.maxAge).toBe(0);
    expect(requestIsInternal(req)).toBe(false);
  });

  it("leaves the cookie alone without the param, and middleware applies it", () => {
    const plain = new NextRequest("https://www.yallcomeback.app/help", {
      headers: { cookie: "ycb_internal=1" },
    });
    expect(applyInternalCookie(plain, NextResponse.next()).cookies.get(INTERNAL_COOKIE)).toBeUndefined();
    expect(requestIsInternal(plain)).toBe(true);

    const toggled = new NextRequest("https://www.yallcomeback.app/help?ycb_test=1");
    const res = applyVisitorCookies(toggled, NextResponse.next());
    expect(res.cookies.get(INTERNAL_COOKIE)?.value).toBe("1");
  });
});
