import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("returns the value when work is quick", async () => {
    await expect(withTimeout(Promise.resolve("visa 4242"), 50)).resolves.toBe("visa 4242");
  });
  it("returns null when work is slow (page never waits on Stripe)", async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>((r) => setTimeout(() => r("late"), 25_000));
    const p = withTimeout(slow, 4_000);
    vi.advanceTimersByTime(4_000);
    await expect(p).resolves.toBeNull();
    vi.useRealTimers();
  });
  it("returns null on error", async () => {
    await expect(withTimeout(Promise.reject(new Error("x")), 50)).resolves.toBeNull();
  });
});
