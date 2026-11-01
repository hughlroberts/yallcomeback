import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isInboundEmailEnabled,
  parseReplyAddress,
  replyAddressFor,
} from "./reply-address";

const KEYS = [
  "INBOUND_EMAIL_DOMAIN",
  "INBOUND_EMAIL_TOKEN_SECRET",
  "RESEND_INBOUND_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "MESSAGING_EMAIL_API_KEY",
];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function enable() {
  process.env.INBOUND_EMAIL_DOMAIN = "reply.example.test";
  process.env.INBOUND_EMAIL_TOKEN_SECRET = "test-secret-0123456789abcdef";
  process.env.RESEND_INBOUND_WEBHOOK_SECRET = "whsec_dGVzdA==";
  process.env.RESEND_API_KEY = "re_test";
}

describe("reply addresses", () => {
  it("is off and returns null unless every setting is present", () => {
    expect(isInboundEmailEnabled()).toBe(false);
    expect(replyAddressFor("c", "cmabc12345", "GUEST")).toBeNull();
    process.env.INBOUND_EMAIL_DOMAIN = "reply.example.test";
    process.env.INBOUND_EMAIL_TOKEN_SECRET = "test-secret-0123456789abcdef";
    expect(isInboundEmailEnabled()).toBe(false);
  });

  it("round-trips a signed address under 64 chars of local part", () => {
    enable();
    const a = replyAddressFor("c", "cmabc12345xyz0000000000000", "HOST")!;
    expect(a).toMatch(
      /^reply\+c-h-cmabc12345xyz0000000000000-[0-9a-f]{20}@reply\.example\.test$/,
    );
    expect(a.split("@")[0].length).toBeLessThanOrEqual(64);
    expect(parseReplyAddress(a)).toEqual({
      kind: "c",
      role: "HOST",
      id: "cmabc12345xyz0000000000000",
    });
    expect(parseReplyAddress(a.toUpperCase())).not.toBeNull();
    const b = replyAddressFor("b", "cmbook12345", "GUEST")!;
    expect(parseReplyAddress(b)).toEqual({
      kind: "b",
      role: "GUEST",
      id: "cmbook12345",
    });
  });

  it("rejects forged, swapped or foreign addresses", () => {
    enable();
    const a = replyAddressFor("c", "cmabc12345", "GUEST")!;
    // Swap the role: signature no longer matches.
    expect(parseReplyAddress(a.replace("c-g-", "c-h-"))).toBeNull();
    // Point at another thread.
    expect(parseReplyAddress(a.replace("cmabc12345", "cmzzz99999"))).toBeNull();
    // Wrong domain.
    expect(
      parseReplyAddress(a.replace("reply.example.test", "evil.test")),
    ).toBeNull();
    // Different secret.
    process.env.INBOUND_EMAIL_TOKEN_SECRET = "another-secret-0123456789";
    expect(parseReplyAddress(a)).toBeNull();
    expect(parseReplyAddress("bookings@yallcomeback.app")).toBeNull();
  });
});
