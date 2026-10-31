import { describe, expect, it } from "vitest";
import {
  isOpsPath,
  isOpsAdminRequest,
  platformGate,
  signInRedirect,
} from "@/auth.config";
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

  const opsPaths = [
    "/ops",
    "/ops/users",
    "/ops/users/export",
    "/ops/settings/backups/download",
    "/ops/settings/backups/file/x.json",
    "/ops/hosting/plans?tab=1",
  ];
  const nonAdmins: Array<{ who: string; isLoggedIn: boolean; role?: string }> = [
    { who: "signed out", isLoggedIn: false },
    { who: "guest", isLoggedIn: true, role: "GUEST" },
    { who: "host / host admin", isLoggedIn: true, role: "HOST" },
    { who: "role missing", isLoggedIn: true, role: undefined },
  ];

  describe.each(nonAdmins)("/ops for $who", ({ isLoggedIn, role }) => {
    it.each(opsPaths)(
      "%s passes through like an unknown URL (no login, no notice, no rewrite)",
      (path) => {
        const nextUrl = new URL(`https://www.yallcomeback.app${path}`);
        // No Response at all: no redirect, no admin_only, and no
        // x-middleware-rewrite header that a random 404 would not have.
        // The ops layout/pages/routes notFound() non-admins themselves.
        expect(platformGate({ isLoggedIn, role, nextUrl })).toBe(true);
        // ...and middleware adds no ops-only header (noindex) for them.
        expect(isOpsAdminRequest(nextUrl.pathname, role)).toBe(false);
      },
    );
  });

  it("marks only platform-admin /ops requests for ops-only headers", () => {
    expect(isOpsAdminRequest("/ops/users", "ADMIN")).toBe(true);
    expect(isOpsAdminRequest("/marketplace", "ADMIN")).toBe(false);
    expect(isOpsAdminRequest("/ops", "HOST")).toBe(false);
  });

  it("lets platform admins into /ops", () => {
    for (const path of opsPaths) {
      expect(
        platformGate({
          isLoggedIn: true,
          role: "ADMIN",
          nextUrl: new URL(`https://www.yallcomeback.app${path}`),
        }),
      ).toBe(true);
    }
  });

  it("only treats /ops and /ops/* as ops", () => {
    expect(isOpsPath("/ops")).toBe(true);
    expect(isOpsPath("/ops/users")).toBe(true);
    expect(isOpsPath("/opsfoo")).toBe(false);
    expect(isOpsPath("/admin")).toBe(false);
  });

  it("sends anonymous /admin visitors to login without an error code", () => {
    const gate = platformGate({ isLoggedIn: false, nextUrl });
    const location = new URL((gate as Response).headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBeNull();
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
