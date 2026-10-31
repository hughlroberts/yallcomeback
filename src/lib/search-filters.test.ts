import { describe, expect, it } from "vitest";
import { checkSearchDates, earliestTodayYmd } from "./search-dates";
import {
  appendListingFilterParams,
  hasListingFilters,
  listingFilterLabels,
  listingFiltersFromParams,
  listingMatchesFilters,
} from "./search-filters";

const params = (q: string) => {
  const sp = new URLSearchParams(q);
  return (k: string) => sp.get(k);
};

describe("listing filters", () => {
  it("parses bedrooms, price and amenities (alias amenity)", () => {
    expect(
      listingFiltersFromParams(
        params(
          "bedrooms=2&minNightly=100&maxNightly=250&amenities=Lake_View, wifi,,wifi",
        ),
      ),
    ).toEqual({
      bedrooms: 2,
      minNightly: 100,
      maxNightly: 250,
      amenities: ["lake_view", "wifi"],
    });
    expect(listingFiltersFromParams(params("amenity=hot_tub"))).toEqual({
      amenities: ["hot_tub"],
    });
    expect(listingFiltersFromParams(params("bedrooms=abc&where=x"))).toEqual(
      {},
    );
    expect(hasListingFilters({})).toBe(false);
    expect(hasListingFilters({ amenities: ["wifi"] })).toBe(true);
  });

  it("matches listings like the agent API did", () => {
    const p = {
      bedrooms: 3,
      baseNightlyRate: 180,
      amenities: JSON.stringify(["lake_view", "WiFi"]),
    };
    expect(listingMatchesFilters(p, { amenities: ["lake_view", "wifi"] })).toBe(
      true,
    );
    expect(listingMatchesFilters(p, { amenities: ["hot_tub"] })).toBe(false);
    expect(listingMatchesFilters(p, { bedrooms: 4 })).toBe(false);
    expect(listingMatchesFilters(p, { minNightly: 200 })).toBe(false);
    expect(listingMatchesFilters(p, { maxNightly: 150 })).toBe(false);
    expect(
      listingMatchesFilters({ ...p, amenities: null }, { amenities: ["wifi"] }),
    ).toBe(false);
  });

  it("writes every active filter into a search URL", () => {
    const sp = new URLSearchParams({ where: "Malakoff" });
    appendListingFilterParams(sp, {
      bedrooms: 2,
      maxNightly: 300,
      amenities: ["lake_view", "wifi"],
    });
    expect(sp.toString()).toBe(
      "where=Malakoff&bedrooms=2&maxNightly=300&amenities=lake_view%2Cwifi",
    );
    expect(
      listingFilterLabels({
        bedrooms: 2,
        maxNightly: 300,
        amenities: ["lake_view"],
      }),
    ).toEqual(["2+ bedrooms", "up to $300/night", "lake view"]);
  });
});

describe("checkSearchDates", () => {
  const today = "2026-11-01";

  it("accepts no dates, one-sided dates, and today onward", () => {
    expect(checkSearchDates(undefined, undefined, today)).toEqual({
      ok: true,
      checkIn: undefined,
      checkOut: undefined,
    });
    expect(checkSearchDates("2026-11-01", "2026-11-02", today).ok).toBe(true);
    expect(checkSearchDates("2026-11-05", undefined, today).ok).toBe(true);
  });

  it("rejects past dates", () => {
    const r = checkSearchDates("2026-10-30", "2026-11-03", today);
    expect(r).toMatchObject({ ok: false, code: "past_dates" });
    expect(checkSearchDates(undefined, "2026-10-20", today)).toMatchObject({
      ok: false,
      code: "past_dates",
    });
  });

  it("rejects check-out on or before check-in", () => {
    expect(checkSearchDates("2026-11-10", "2026-11-08", today)).toMatchObject({
      ok: false,
      code: "checkout_not_after_checkin",
    });
    expect(checkSearchDates("2026-11-10", "2026-11-10", today)).toMatchObject({
      ok: false,
      code: "checkout_not_after_checkin",
    });
  });

  it("rejects malformed or impossible dates", () => {
    expect(checkSearchDates("11/10/2026", "2026-11-12", today)).toMatchObject({
      ok: false,
      code: "invalid_date",
    });
    expect(checkSearchDates("2026-02-30", "2026-03-02", today)).toMatchObject({
      ok: false,
      code: "invalid_date",
    });
  });

  it("uses the earliest time zone's date so evening guests in the US are not rejected", () => {
    // 01:00 UTC Nov 1 is still Oct 31 in Chicago (and in UTC−12)
    expect(earliestTodayYmd(new Date("2026-11-01T01:00:00Z"))).toBe(
      "2026-10-31",
    );
    expect(earliestTodayYmd(new Date("2026-11-01T13:00:00Z"))).toBe(
      "2026-11-01",
    );
  });
});
