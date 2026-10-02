import { describe, expect, it } from "vitest";
import {
  parseRememberSearch,
  rememberHaystack,
  rememberScore,
} from "@/lib/remember-search";

describe("parseRememberSearch", () => {
  it("returns nothing for blank text", () => {
    expect(parseRememberSearch("  ")).toEqual({ tokens: [] });
  });

  it("pulls party size and stay words", () => {
    const p = parseRememberSearch(
      "Cedar Creek dock cabin, we grilled, about 8 people",
    );
    expect(p.guests).toBe(8);
    expect(p.tokens).toContain("cedar");
    expect(p.tokens).toContain("creek");
    expect(p.tokens).toContain("dock");
    expect(p.tokens).toContain("cabin");
    expect(p.tokens).toContain("grill");
    expect(p.tokens).toContain("grilled");
  });

  it("treats two dogs as pets", () => {
    const p = parseRememberSearch("the lake house with two dogs");
    expect(p.pets).toBe(2);
    expect(p.tokens).toContain("lake");
  });
});

describe("rememberScore", () => {
  it("ranks a dock listing over an unrelated one", () => {
    const tokens = parseRememberSearch("dock cabin we grilled").tokens;
    const dock = rememberHaystack({
      title: "Waterfront cabin",
      description: "Private dock and a grill by the water",
      city: "Log Cabin",
      amenities: '["private_dock","grill"]',
      host: { name: "Cherokee Landing" },
    });
    const other = rememberHaystack({
      title: "Downtown loft",
      description: "Walk to restaurants",
      city: "Dallas",
      amenities: "[]",
      host: { name: "City Stays" },
    });
    expect(rememberScore(dock, tokens)).toBeGreaterThan(
      rememberScore(other, tokens),
    );
    expect(rememberScore(other, tokens)).toBe(0);
  });
});
