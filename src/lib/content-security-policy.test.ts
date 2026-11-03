import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./content-security-policy";

function directive(name: string): string[] {
  const part = contentSecurityPolicy
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name} `));
  return part ? part.split(/\s+/).slice(1) : [];
}

describe("CSP form-action (T38b)", () => {
  it("lets billing form redirects reach hosted Checkout and the portal", () => {
    // Browsers apply form-action to the 303 after a form POST.
    const allowed = directive("form-action");
    for (const url of [
      "https://checkout.stripe.com/c/pay/cs_test_123",
      "https://billing.stripe.com/p/session/test_123",
    ]) {
      expect(allowed).toContain(new URL(url).origin);
    }
    expect(allowed).toContain("'self'");
  });

  it("does not open other directives", () => {
    expect(directive("form-action")).not.toContain("*");
    expect(directive("default-src")).toEqual(["'self'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("connect-src")).toEqual(["'self'"]);
  });
});
