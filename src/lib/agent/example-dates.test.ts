import { describe, expect, it } from "vitest";
import { agentExampleDates } from "@/lib/agent/example-dates";

describe("agentExampleDates", () => {
  it("returns future check-in/out relative to now", () => {
    const now = new Date("2026-10-30T12:00:00.000Z");
    const d = agentExampleDates(now);
    expect(d.generated).toBe("2026-10-30");
    expect(d.checkIn > d.generated).toBe(true);
    expect(d.checkOut > d.checkIn).toBe(true);
    expect(d.from < d.checkIn).toBe(true);
    // 56 days out, 3-night stay
    expect(d.checkIn).toBe("2026-12-25");
    expect(d.checkOut).toBe("2026-12-28");
    expect(d.from).toBe("2026-12-11");
  });
});
