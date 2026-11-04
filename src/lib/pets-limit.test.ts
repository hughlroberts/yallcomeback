import { describe, expect, it } from "vitest";
import {
  PET_SELECT_FALLBACK_MAX,
  effectiveMaxPets,
  petRuleLine,
  petsForListingLink,
  resolvePetCharges,
} from "./pets";
import { SEARCH_MAX_PETS } from "./search-filters";

const allow = (maxPets: number | null) => ({ petsAllowed: true, petFee: 25, petFeeUnit: "PER_PET", maxPets });

describe("T56: global pets limit is 4", () => {
  it("shared constant is 4", () => {
    expect(SEARCH_MAX_PETS).toBe(4);
    expect(PET_SELECT_FALLBACK_MAX).toBe(4);
  });

  it("picker max: 0 / over-4 listing caps become 4, lower listing max wins", () => {
    expect(effectiveMaxPets(allow(0))).toBe(4);
    expect(effectiveMaxPets(allow(null))).toBe(4);
    expect(effectiveMaxPets(allow(6))).toBe(4);
    expect(effectiveMaxPets(allow(10))).toBe(4);
    expect(effectiveMaxPets(allow(2))).toBe(2);
    expect(effectiveMaxPets({ ...allow(3), petsAllowed: false })).toBe(0);
  });

  it("charges: 4 ok, 5 refused even on an old cap-6 listing; per-listing cap still refuses", () => {
    expect(resolvePetCharges(allow(6), 4)).toMatchObject({ pets: 4, petFee: 100 });
    expect(resolvePetCharges(allow(6), 4).error).toBeUndefined();
    expect(resolvePetCharges(allow(6), 5).error).toContain("maximum of 4");
    expect(resolvePetCharges(allow(0), 5).error).toContain("maximum of 4");
    expect(resolvePetCharges(allow(2), 3).error).toContain("maximum of 2");
  });

  it("links and rule line never show more than 4", () => {
    expect(petsForListingLink(allow(6), 4)).toBe(4);
    expect(petsForListingLink(allow(6), 5)).toBeUndefined();
    expect(petsForListingLink(allow(2), 3)).toBeUndefined();
    expect(petRuleLine(allow(8))).toContain("max 4");
    expect(petRuleLine(allow(2))).toContain("max 2");
  });
});
