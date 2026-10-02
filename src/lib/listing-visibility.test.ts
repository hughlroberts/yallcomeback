import { describe, expect, it } from "vitest";
import {
  flagsFromVisibility,
  visibilityFromFlags,
  visibilityLabel,
} from "./listing-visibility";

describe("listing visibility", () => {
  it("maps flags to a single control", () => {
    expect(visibilityFromFlags(false, false)).toBe("off");
    expect(visibilityFromFlags(false, true)).toBe("off");
    expect(visibilityFromFlags(true, false)).toBe("website");
    expect(visibilityFromFlags(true, true)).toBe("both");
  });

  it("never lists on Find a Place while the stay is off", () => {
    expect(flagsFromVisibility("off")).toEqual({
      published: false,
      listOnMarketplace: false,
    });
    expect(flagsFromVisibility("website")).toEqual({
      published: true,
      listOnMarketplace: false,
    });
    expect(flagsFromVisibility("both")).toEqual({
      published: true,
      listOnMarketplace: true,
    });
    expect(flagsFromVisibility("nope")).toEqual({
      published: false,
      listOnMarketplace: false,
    });
  });

  it("labels on vs off in host language", () => {
    expect(visibilityLabel("off")).toMatch(/Off/i);
    expect(visibilityLabel("website")).toMatch(/website only/i);
    expect(visibilityLabel("both")).toMatch(/Find a Place/i);
  });
});
