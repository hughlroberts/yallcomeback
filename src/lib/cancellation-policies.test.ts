import { describe, expect, it } from "vitest";
import {
  getShortStayPolicy,
  guestFacingBullets,
  SHORT_STAY_POLICIES,
} from "@/lib/cancellation-policies";

/**
 * H1: Moderate summary and detail must agree on late-cancel economics:
 * host keeps one night + 50% of unused nights; guest gets the other 50%
 * of unused nights (not taxes-only like Flexible).
 */
describe("H1 Moderate cancellation copy matches policy logic", () => {
  const moderate = getShortStayPolicy("MODERATE");

  it("summary states one-night + 50% unused for later cancels", () => {
    expect(moderate.summary).toMatch(/5 days/i);
    expect(moderate.summary).toMatch(/one night/i);
    expect(moderate.summary).toMatch(/50%\s+of unused nights/i);
  });

  it("host payout bullet matches summary (stay + one night + 50% unused)", () => {
    const hostLine = moderate.bullets.find((b) =>
      /^You are paid/i.test(b),
    );
    expect(hostLine).toBeTruthy();
    expect(hostLine).toMatch(/one more night/i);
    expect(hostLine).toMatch(/50%.*unused nights/i);
  });

  it("guest-facing late-cancel is 50% unused after one night, not taxes-only", () => {
    const guest = guestFacingBullets(moderate, 5);
    const later = guest.find((b) => /cancel later/i.test(b));
    expect(later).toBeTruthy();
    expect(later).toMatch(/50%/);
    expect(later).toMatch(/unused nights/i);
    expect(later).toMatch(/one night/i);
    // Must not be the Flexible-style taxes-only late cancel.
    expect(later).not.toMatch(/pro-rated taxes\.?$/i);
    expect(later).not.toMatch(/pro-rated taxes only/i);
  });

  it("guest-facing lines never contradict summary keywords", () => {
    const guest = guestFacingBullets(moderate, 5).join(" ");
    expect(guest).toMatch(/5 days/i);
    expect(guest).toMatch(/50%/);
    expect(guest).toMatch(/one night/i);
  });
});

describe("cancellation policies single source", () => {
  it("exports Moderate as default short-stay policy", () => {
    expect(SHORT_STAY_POLICIES.some((p) => p.id === "MODERATE")).toBe(true);
  });

  it("Flexible late cancel stays taxes-only (contrast with Moderate)", () => {
    const flex = getShortStayPolicy("FLEXIBLE");
    const later = guestFacingBullets(flex, 5).find((b) =>
      /cancel later/i.test(b),
    );
    expect(later).toMatch(/pro-rated taxes/i);
  });
});
