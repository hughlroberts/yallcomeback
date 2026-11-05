import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "./openapi";

describe("openapi /api/v1/search params name their 400 codes", () => {
  it("documents every search 400 on the parameter that triggers it", () => {
    const doc = buildOpenApiDocument("https://example.test") as unknown as {
      paths: Record<string, { get: { parameters: { name: string; description?: string }[] } }>;
    };
    const params = doc.paths["/api/v1/search"].get.parameters;
    const d = (n: string) => params.find((p) => p.name === n)?.description ?? "";
    expect(d("location")).toMatch(/invalid_location/);
    expect(d("location")).toMatch(/lake/);
    expect(d("checkIn")).toMatch(/incomplete_dates/);
    expect(d("checkOut")).toMatch(/stay_too_long/);
    expect(d("flexibilityDays")).toMatch(/invalid_flexibility_days/);
    expect(d("minNightly")).toMatch(/invalid_price_range/);
    expect(d("maxNightly")).toMatch(/invalid_price_range/);
    expect(d("guests")).toMatch(/invalid_guests/);
    expect(d("take")).toMatch(/invalid_limit/);
    for (const p of params) expect(p.description ?? "", p.name).not.toMatch(/capped at 50|clamped to/i);
  });
});
