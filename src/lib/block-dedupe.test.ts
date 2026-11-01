import { describe, expect, it } from "vitest";
import {
  DUPLICATE_BLOCK_WINDOW_MS,
  newClientRequestId,
  normalizeClientRequestId,
} from "./block-dedupe";

describe("block dedupe keys", () => {
  it("accepts UUIDs and url-safe keys", () => {
    const id = newClientRequestId();
    expect(normalizeClientRequestId(id)).toBe(id);
    expect(normalizeClientRequestId("  abc_DEF-123  ")).toBe("abc_DEF-123");
  });

  it("rejects missing, short, long or odd keys", () => {
    expect(normalizeClientRequestId(null)).toBeNull();
    expect(normalizeClientRequestId("short")).toBeNull();
    expect(normalizeClientRequestId("a".repeat(65))).toBeNull();
    expect(normalizeClientRequestId("has spaces in it")).toBeNull();
    expect(normalizeClientRequestId("<script>alert</script>")).toBeNull();
  });

  it("makes a new key each time", () => {
    expect(newClientRequestId()).not.toBe(newClientRequestId());
  });

  it("dedupe window is short", () => {
    expect(DUPLICATE_BLOCK_WINDOW_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
