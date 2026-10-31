import { describe, expect, it } from "vitest";
import { platformGate, signInRedirect } from "@/auth.config";
import { ipFromHeaders } from "@/lib/rate-limit";
import { assertSafeOutboundUrl, pinnedLookup } from "@/lib/safe-url";

describe("platformGate", () => {
  const nextUrl = new URL("https://www.yallcomeback.app/admin/calendar?tab=1");

  it("sends anonymous admin visitors to login", () => {
    const gate = platformGate({ isLoggedIn: false, nextUrl });
    expect(gate).toBeInstanceOf(Response);
    const location = (gate as Response).headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain(
      encodeURIComponent("/admin/calendar?tab=1"),
    );
  });

  it("lets a signed-in host through admin", () => {
    expect(
      platformGate({ isLoggedIn: true, role: "HOST", nextUrl }),
    ).toBe(true);
  });

  it("sends a signed-in host away from ops", () => {
    const gate = platformGate({
      isLoggedIn: true,
      role: "HOST",
      nextUrl: new URL("https://www.yallcomeback.app/ops"),
    });
    expect(gate).toBeInstanceOf(Response);
    expect((gate as Response).headers.get("location")).toContain(
      "/admin?error=admin_only",
    );
  });

  it("builds a same-origin login redirect", () => {
    const res = signInRedirect(nextUrl);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.origin).toBe("https://www.yallcomeback.app");
    expect(location.pathname).toBe("/login");
  });
});

describe("ipFromHeaders", () => {
  it("uses the Railway X-Real-IP and ignores a caller CF-Connecting-IP", () => {
    const headers = new Headers({
      "cf-connecting-ip": "203.0.113.5",
      "x-forwarded-for": "198.51.100.8, 10.0.0.1",
      "x-real-ip": "192.0.2.10",
    });
    expect(ipFromHeaders(headers)).toBe("192.0.2.10");
  });

  it("does not fall back to a caller-supplied forwarding header", () => {
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.8",
    });
    expect(ipFromHeaders(headers)).toBe("unknown");
  });
});

describe("outbound URL pinning", () => {
  it("rejects a loopback address before any fetch", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1/secret")).rejects.toThrow(
      /not allowed/i,
    );
  });

  it("pins the connection lookup to the address that was checked", () => {
    const lookup = pinnedLookup("203.0.113.9");
    lookup("calendar.example", {}, (err, address, family) => {
      expect(err).toBeNull();
      expect(address).toBe("203.0.113.9");
      expect(family).toBe(4);
    });
    lookup("calendar.example", { all: true }, (err, addresses) => {
      expect(err).toBeNull();
      expect(addresses).toEqual([{ address: "203.0.113.9", family: 4 }]);
    });
  });
});
