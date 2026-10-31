import { describe, expect, it } from "vitest";
import {
  UNRESOLVED_ADDRESS_MESSAGE,
  locationAfterLookupFailure,
  locationAfterPin,
  locationContinueAnyway,
  locationMissingFields,
  parseManualCoords,
  type WizardLocationValues,
} from "@/lib/wizard-location";

const base: WizardLocationValues = {
  address: "1 Lake Rd",
  city: "Cherokee",
  region: "TX",
  country: "USA",
  postalCode: "",
  lat: 30.1,
  lng: -98.2,
  showPrecise: false,
};

describe("wizard location rules", () => {
  it("clears the stale pin and blocks Next after a failed lookup", () => {
    const failed = locationAfterLookupFailure(base);
    expect(failed.lat).toBeNull();
    expect(failed.lng).toBeNull();
    expect(locationMissingFields(failed)).toEqual([UNRESOLVED_ADDRESS_MESSAGE]);
  });

  it("unblocks after manual coordinates", () => {
    const failed = locationAfterLookupFailure(base);
    const fixed = locationAfterPin(failed, 31, -97);
    expect(locationMissingFields(fixed)).toEqual([]);
    expect([fixed.lat, fixed.lng]).toEqual([31, -97]);
  });

  it("unblocks after Continue anyway without a pin", () => {
    const ok = locationContinueAnyway(locationAfterLookupFailure(base));
    expect(locationMissingFields(ok)).toEqual([]);
    expect(ok.lat).toBeNull();
  });

  it("needs a street or city", () => {
    expect(
      locationMissingFields({ ...base, address: " ", city: "" }),
    ).toEqual(["Street address or city"]);
  });

  it("validates manual coordinates", () => {
    expect(parseManualCoords("32.77671234", "-96.797")).toEqual({
      lat: 32.776712,
      lng: -96.797,
    });
    expect(parseManualCoords("", "1")).toHaveProperty("error");
    expect(parseManualCoords("abc", "1")).toHaveProperty("error");
    expect(parseManualCoords("91", "1")).toHaveProperty("error");
  });
});
