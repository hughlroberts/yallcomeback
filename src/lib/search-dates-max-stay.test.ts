import { describe, expect, it } from "vitest";
import { MAX_STAY_NIGHTS, checkSearchDates } from "./search-dates";

describe("R1104-8 max stay length", () => {
  it("allows exactly 90 nights and rejects 91", () => {
    expect(MAX_STAY_NIGHTS).toBe(90);
    // 2027-01-01 + 90 nights = 2027-04-01
    expect(checkSearchDates("2027-01-01", "2027-04-01")).toMatchObject({ ok: true });
    expect(checkSearchDates("2027-01-01", "2027-04-02")).toMatchObject({
      ok: false,
      code: "stay_too_long",
    });
  });
});
