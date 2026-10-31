import { describe, expect, it } from "vitest";
import { isWelcomeForced, shouldShowIntentGate } from "./intent-cookie";

const base = { isTenantSite: false, isHostOrAdmin: false, intentCookie: null };

describe("shouldShowIntentGate", () => {
  it("shows on first visit, hides once ycb_intent is set", () => {
    expect(shouldShowIntentGate(base)).toBe(true);
    expect(shouldShowIntentGate({ ...base, intentCookie: "browse" })).toBe(false);
  });

  it("?welcome=1 forces it regardless of the cookie or role", () => {
    expect(
      shouldShowIntentGate({ ...base, intentCookie: "find", welcomeParam: "1" }),
    ).toBe(true);
    expect(
      shouldShowIntentGate({ ...base, isHostOrAdmin: true, welcomeParam: "1" }),
    ).toBe(true);
    expect(
      shouldShowIntentGate({ ...base, intentCookie: "find", welcomeParam: "0" }),
    ).toBe(false);
  });

  it("never shows on host custom sites", () => {
    expect(
      shouldShowIntentGate({ ...base, isTenantSite: true, welcomeParam: "1" }),
    ).toBe(false);
  });

  it("parses welcome values", () => {
    expect(isWelcomeForced(["1", "0"])).toBe(true);
    expect(isWelcomeForced("TRUE")).toBe(true);
    expect(isWelcomeForced(undefined)).toBe(false);
  });
});
