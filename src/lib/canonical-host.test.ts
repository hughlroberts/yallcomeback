import { describe, expect, it } from "vitest";
import { bareDomainRedirect, httpsRedirect } from "./canonical-host";

describe("bare domain → https://www", () => {
  it("keeps path and query", () => {
    expect(
      bareDomainRedirect({ hostname: "yallcomeback.app", pathname: "/stays", search: "?q=lake" }),
    ).toBe("https://www.yallcomeback.app/stays?q=lake");
    expect(bareDomainRedirect({ hostname: "YallComeBack.app", pathname: "/", search: "" })).toBe(
      "https://www.yallcomeback.app/",
    );
  });

  it("leaves www, custom domains, and localhost alone (no loop)", () => {
    for (const hostname of ["www.yallcomeback.app", "www.cherokeelanding.net", "localhost", null]) {
      expect(bareDomainRedirect({ hostname, pathname: "/", search: "" })).toBeNull();
    }
  });
});

describe("http → https://www (R1/T2)", () => {
  const r = (hostname: string | null, forwardedProto: string | null, pathname = "/stays", search = "?q=1") =>
    httpsRedirect({ hostname, forwardedProto, pathname, search });
  it("www and bare over http go to https://www with the same path and query", () => {
    expect(r("www.yallcomeback.app", "http")).toBe("https://www.yallcomeback.app/stays?q=1");
    expect(r("yallcomeback.app", "http, https")).toBe("https://www.yallcomeback.app/stays?q=1");
  });
  it("https, custom domains, localhost and unknown proto are left alone", () => {
    expect(r("www.yallcomeback.app", "https")).toBeNull();
    expect(r("www.yallcomeback.app", null)).toBeNull();
    expect(r("www.cherokeelanding.net", "http")).toBeNull();
    expect(r("localhost", "http")).toBeNull();
  });
  it("never redirects /api (webhooks, cron, health)", () => {
    for (const p of ["/api/stripe/webhook", "/api/resend/webhook", "/api/cron/daily", "/api/health", "/api"]) {
      expect(r("www.yallcomeback.app", "http", p, "")).toBeNull();
    }
  });
});
