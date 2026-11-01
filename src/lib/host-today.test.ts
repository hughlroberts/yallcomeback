import { describe, expect, it } from "vitest";
import { dateFromYmd, hostTodayYmd, monthStartFromYmd } from "./host-today";

describe("hostTodayYmd", () => {
  it("uses the host zone, not UTC, in the evening", () => {
    // Oct 31, 10:04 PM CDT = Nov 1, 03:04 UTC
    const now = new Date("2026-11-01T03:04:00Z");
    expect(hostTodayYmd(now)).toBe("2026-10-31");
    expect(hostTodayYmd(now, "UTC")).toBe("2026-11-01");
  });

  it("is the same whatever zone the process runs in", () => {
    const now = new Date("2026-11-01T03:04:00Z");
    const prev = process.env.TZ;
    try {
      const seen = ["UTC", "America/Los_Angeles", "Asia/Tokyo"].map((tz) => {
        process.env.TZ = tz;
        return hostTodayYmd(now);
      });
      expect(new Set(seen)).toEqual(new Set(["2026-10-31"]));
    } finally {
      process.env.TZ = prev;
    }
  });
});

describe("dateFromYmd / monthStartFromYmd", () => {
  it("keep the calendar day", () => {
    const d = dateFromYmd("2026-10-31");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 31]);
    const m = monthStartFromYmd("2026-10-31");
    expect([m.getMonth(), m.getDate()]).toEqual([9, 1]);
  });
});
