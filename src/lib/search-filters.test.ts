import { describe, expect, it } from "vitest";
import { checkSearchDates, earliestTodayYmd } from "./search-dates";
import {
  appendListingFilterParams,
  clampGuestsInput,
  hasListingFilters,
  listingFilterLabels,
  listingFiltersFromParams,
  listingMatchesFilters,
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_GUESTS,
  SEARCH_MAX_LIMIT,
  searchGuests,
  searchLimit,
  searchLimitFromParams,
  strictSearchLimitFromParams,
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

describe("searchLimit", () => {
  it("defaults to 20 (also for 0, negative, non-numeric) and caps at 50", () => {
    expect(SEARCH_DEFAULT_LIMIT).toBe(20);
    expect(SEARCH_MAX_LIMIT).toBe(50);
    expect(searchLimit(undefined)).toBe(20);
    expect(searchLimit("")).toBe(20);
    expect(searchLimit("x")).toBe(20);
    expect(searchLimit("8.9")).toBe(20);
    expect(searchLimit("2.5")).toBe(20);
    expect(searchLimit(2.5)).toBe(20);
    expect(searchLimit("8.0")).toBe(8);
    expect(searchLimit("0")).toBe(20);
    expect(searchLimit(0)).toBe(20);
    expect(searchLimit("-1")).toBe(20);
    expect(searchLimit(-3)).toBe(20);
    expect(searchLimit("0.5")).toBe(20);
    expect(searchLimit("NaN")).toBe(20);
    expect(searchLimit("Infinity")).toBe(20);
    expect(searchLimit("1")).toBe(1);
    expect(searchLimit("50")).toBe(50);
    expect(searchLimit("999")).toBe(50);
  });
  it("reads take, then limit", () => {
    expect(searchLimitFromParams(params("limit=9"))).toBe(9);
    expect(searchLimitFromParams(params("take=4&limit=9"))).toBe(4);
    expect(searchLimitFromParams(params(""))).toBe(20);
  });
});

describe("searchGuests", () => {
  it("caps at the search form max and drops junk", () => {
    expect(SEARCH_MAX_GUESTS).toBe(50);
    expect(searchGuests(99)).toBe(50);
    expect(searchGuests("4")).toBe(4);
    expect(searchGuests(2.7)).toBe(2);
    expect(searchGuests(0)).toBeUndefined();
    expect(searchGuests("abc")).toBeUndefined();
    expect(searchGuests(undefined)).toBeUndefined();
  });
});

describe("strictSearchLimitFromParams (agent API)", () => {
  it("defaults to 20 when missing or empty and takes whole numbers 1–50", () => {
    expect(strictSearchLimitFromParams(params(""))).toEqual({
      ok: true,
      take: SEARCH_DEFAULT_LIMIT,
    });
    expect(strictSearchLimitFromParams(params("limit="))).toEqual({
      ok: true,
      take: SEARCH_DEFAULT_LIMIT,
    });
    expect(strictSearchLimitFromParams(params("limit=1"))).toEqual({
      ok: true,
      take: 1,
    });
    expect(strictSearchLimitFromParams(params("limit=50"))).toEqual({
      ok: true,
      take: SEARCH_MAX_LIMIT,
    });
    expect(strictSearchLimitFromParams(params("take=7&limit=30"))).toEqual({
      ok: true,
      take: 7,
    });
  });

  it("rejects decimals, out-of-range and junk, naming the param", () => {
    for (const q of [
      "limit=2.5",
      "limit=0",
      "limit=-3",
      "limit=51",
      "limit=abc",
    ]) {
      const r = strictSearchLimitFromParams(params(q));
      expect(r.ok, q).toBe(false);
      if (!r.ok) {
        expect(r.param).toBe("limit");
        expect(r.error).toMatch(/whole number from 1 to 50/);
      }
    }
    const t = strictSearchLimitFromParams(params("take=2.5&limit=5"));
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.param).toBe("take");
  });
});

describe("clampGuestsInput (guests box on blur)", () => {
  it("clamps typed values to 1–50", () => {
    expect(clampGuestsInput("0")).toBe("1");
    expect(clampGuestsInput("-4")).toBe("1");
    expect(clampGuestsInput("51")).toBe(String(SEARCH_MAX_GUESTS));
    expect(clampGuestsInput("500")).toBe("50");
    expect(clampGuestsInput("2.7")).toBe("2");
    expect(clampGuestsInput(" 6 ")).toBe("6");
    expect(clampGuestsInput("50")).toBe("50");
    expect(clampGuestsInput("1")).toBe("1");
  });

  it("leaves empty or junk empty (Any)", () => {
    expect(clampGuestsInput("")).toBe("");
    expect(clampGuestsInput("  ")).toBe("");
    expect(clampGuestsInput("abc")).toBe("");
  });
});
