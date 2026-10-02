import { describe, expect, it } from "vitest";
import { needsEmailVerifyToPublish } from "@/lib/email-verified";

describe("needsEmailVerifyToPublish", () => {
  it("blocks unverified hosts when email is configured", () => {
    expect(
      needsEmailVerifyToPublish({
        emailVerifiedAt: null,
        emailTransport: true,
      }),
    ).toBe(true);
  });

  it("allows a confirmed address", () => {
    expect(
      needsEmailVerifyToPublish({
        emailVerifiedAt: new Date(),
        emailTransport: true,
      }),
    ).toBe(false);
  });

  it("does not block when there is no mail transport (self-host)", () => {
    expect(
      needsEmailVerifyToPublish({
        emailVerifiedAt: null,
        emailTransport: false,
      }),
    ).toBe(false);
  });

  it("lets platform admins publish without a personal confirm", () => {
    expect(
      needsEmailVerifyToPublish({
        emailVerifiedAt: null,
        emailTransport: true,
        bypass: true,
      }),
    ).toBe(false);
  });
});
