import { describe, expect, it } from "vitest";
import { parseStatsRange } from "@/lib/analytics-stats";

describe("parseStatsRange", () => {
  it("builds an inclusive UTC range", () => {
    const r = parseStatsRange("2026-10-01", "2026-10-09");
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.from).toBe("2026-10-01");
    expect(r.to).toBe("2026-10-09");
    expect(r.start.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(r.endExclusive.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("rejects inverted or huge ranges", () => {
    expect(parseStatsRange("2026-10-09", "2026-10-01")).toEqual({
      error: "from must be on or before to",
    });
    expect(parseStatsRange("bad", "2026-10-01")).toEqual({
      error: "from and to must be YYYY-MM-DD",
    });
    const wide = parseStatsRange("2024-01-01", "2026-01-02");
    expect("error" in wide && wide.error).toBe("range cannot exceed 366 days");
  });
});
