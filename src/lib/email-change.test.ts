import { describe, expect, it } from "vitest";
import { normalizeNewEmail } from "@/lib/email-change";

describe("normalizeNewEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeNewEmail("  Host@Example.COM ")).toEqual({
      email: "host@example.com",
    });
  });
  it.each(["", "host", "@example.com", "a@b", "a@b.", "a b@c.com", "a@@b.com"])(
    "rejects %s",
    (raw) => {
      expect(normalizeNewEmail(raw)).toHaveProperty("error");
    },
  );
});
