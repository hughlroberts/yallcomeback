import { describe, expect, it } from "vitest";
import {
  guestEmailClaimOk,
  guestOwnBookingOr,
  guestOwnConversationOr,
} from "./guest-scope";

describe("guestEmailClaimOk", () => {
  it("rejects an unverified address", () => {
    expect(guestEmailClaimOk("a@example.com", null)).toBe(false);
    expect(guestEmailClaimOk("a@example.com", undefined)).toBe(false);
    expect(guestEmailClaimOk(null, new Date())).toBe(false);
  });

  it("allows a confirmed address", () => {
    expect(guestEmailClaimOk("a@example.com", new Date())).toBe(true);
  });
});

describe("guestOwnBookingOr", () => {
  it("matches userId only until the email is confirmed", () => {
    expect(
      guestOwnBookingOr({
        userId: "u1",
        email: "stolen@example.com",
        emailVerifiedAt: null,
      }),
    ).toEqual([{ userId: "u1" }]);
  });

  it("also matches guestEmail after confirm", () => {
    expect(
      guestOwnBookingOr({
        userId: "u1",
        email: "me@example.com",
        emailVerifiedAt: new Date("2026-01-01"),
      }),
    ).toEqual([{ userId: "u1" }, { guestEmail: "me@example.com" }]);
  });
});

describe("guestOwnConversationOr", () => {
  it("does not open another guest's inbox by email alone", () => {
    expect(
      guestOwnConversationOr({
        userId: "u1",
        email: "stolen@example.com",
      }),
    ).toEqual([{ guestUserId: "u1" }]);
  });
});
