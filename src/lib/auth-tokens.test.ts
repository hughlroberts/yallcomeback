import { describe, expect, it } from "vitest";
import { hashAuthToken, newRawAuthToken } from "@/lib/auth-tokens";

describe("auth tokens", () => {
  it("hashes the same raw token the same way", () => {
    const raw = "test-token-value";
    expect(hashAuthToken(raw)).toBe(hashAuthToken(raw));
    expect(hashAuthToken(raw)).toHaveLength(64);
    expect(hashAuthToken(raw)).not.toBe(raw);
  });

  it("does not store a guessable raw token", () => {
    const a = newRawAuthToken();
    const b = newRawAuthToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(hashAuthToken(a)).not.toBe(a);
  });
});
