import { describe, expect, it } from "vitest";
import { bareDomainRedirect } from "./canonical-host";

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
