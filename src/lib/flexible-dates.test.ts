import { describe, expect, it } from "vitest";
import {
  candidateWindows,
  computeFlexibleDates,
  formatStayCount,
  formatWindowLabel,
  marketplaceSearchPath,
  rankFlexibleWindows,
  requiredMinNights,
  stayFit,
  type FlexListing,
  type ScoredWindow,
} from "./flexible-dates";

const d = (ymd: string) => new Date(`${ymd}T00:00:00`);
const utc = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const listing = (over: Partial<FlexListing> = {}): FlexListing => ({
  id: over.id ?? "p",
  defaultMinNights: 1,
  blocks: [],
  seasons: [],
  ...over,
});
const keys = (ws: { checkIn: string; checkOut: string }[]) =>
  ws.map((w) => `${w.checkIn}>${w.checkOut}`);

describe("candidateWindows", () => {
  it("shifts ±1..±3 days keeping length, closest first", () => {
    const ws = candidateWindows({ checkIn: "2026-11-10", checkOut: "2026-11-12", today: "2026-11-01" });
    expect(keys(ws)).toEqual([
      "2026-11-09>2026-11-11",
      "2026-11-11>2026-11-13",
      "2026-11-08>2026-11-10",
      "2026-11-12>2026-11-14",
      "2026-11-07>2026-11-09",
      "2026-11-13>2026-11-15",
    ]);
    expect(ws.every((w) => w.nights === 2 && w.addedNights === 0)).toBe(true);
    expect(ws.map((w) => w.shiftDays)).toEqual([-1, 1, -2, 2, -3, 3]);
  });

  it("extends a 1-night stay to a 2-night minimum after or before", () => {
    const ws = candidateWindows({
      checkIn: "2026-11-06",
      checkOut: "2026-11-07",
      today: "2026-11-01",
      extendTo: [2, 2],
    });
    expect(keys(ws).slice(0, 2)).toEqual(["2026-11-06>2026-11-08", "2026-11-05>2026-11-07"]);
    expect(ws[0]).toMatchObject({ nights: 2, addedNights: 1, shiftDays: 0 });
    expect(ws[1]).toMatchObject({ nights: 2, addedNights: 1, shiftDays: -1 });
    expect(ws).toHaveLength(2 + 6);
  });

  it("ignores minimums that are not longer or too far away", () => {
    const ws = candidateWindows({
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      today: "2026-11-01",
      extendTo: [1, 2, 7],
    });
    expect(ws.some((w) => w.addedNights > 0)).toBe(false);
  });

  it("never suggests a check-in before today and never repeats a window", () => {
    const ws = candidateWindows({
      checkIn: "2026-11-01",
      checkOut: "2026-11-02",
      today: "2026-11-01",
      extendTo: [2],
    });
    expect(ws.every((w) => w.checkIn >= "2026-11-01")).toBe(true);
    expect(new Set(keys(ws)).size).toBe(ws.length);
    expect(keys(ws)).not.toContain("2026-11-01>2026-11-02");
  });

  it("returns nothing for invalid dates", () => {
    expect(candidateWindows({ checkIn: "2026-11-05", checkOut: "2026-11-05", today: "2026-11-01" })).toEqual([]);
    expect(candidateWindows({ checkIn: "nope", checkOut: "2026-11-05", today: "2026-11-01" })).toEqual([]);
  });
});

describe("stayFit / requiredMinNights", () => {
  it("treats block end as exclusive (checkout day is free)", () => {
    const l = listing({ blocks: [{ start: d("2026-11-08"), end: d("2026-11-10") }] });
    expect(stayFit(l, "2026-11-06", "2026-11-08")).toBe("ok");
    expect(stayFit(l, "2026-11-07", "2026-11-09")).toBe("blocked");
    expect(stayFit(l, "2026-11-10", "2026-11-11")).toBe("ok");
  });

  it("reports min_stay when free but too short", () => {
    const l = listing({ defaultMinNights: 2 });
    expect(stayFit(l, "2026-11-06", "2026-11-07")).toBe("min_stay");
    expect(stayFit(l, "2026-11-06", "2026-11-08")).toBe("ok");
  });

  it("blocked wins over min_stay", () => {
    const l = listing({ defaultMinNights: 3, blocks: [{ start: d("2026-11-06"), end: d("2026-11-07") }] });
    expect(stayFit(l, "2026-11-06", "2026-11-07")).toBe("blocked");
  });

  it("peak seasons raise the minimum for nights they cover", () => {
    const l = listing({
      seasons: [{ startDate: utc("2026-11-25"), endDate: utc("2026-11-28"), minNights: 3 }],
    });
    expect(requiredMinNights(l, "2026-11-20", "2026-11-22")).toBe(1);
    expect(requiredMinNights(l, "2026-11-24", "2026-11-26")).toBe(3);
    expect(requiredMinNights(l, "2026-11-28", "2026-11-29")).toBe(3);
    expect(stayFit(l, "2026-11-25", "2026-11-27")).toBe("min_stay");
    expect(stayFit(l, "2026-11-25", "2026-11-28")).toBe("ok");
  });

  it("season minNights 0 keeps the listing default", () => {
    const l = listing({
      defaultMinNights: 2,
      seasons: [{ startDate: utc("2026-11-01"), endDate: utc("2026-11-30"), minNights: 0 }],
    });
    expect(requiredMinNights(l, "2026-11-10", "2026-11-11")).toBe(2);
  });
});

describe("rankFlexibleWindows", () => {
  const w = (checkIn: string, shiftDays: number, count: number, addedNights = 0): ScoredWindow => ({
    checkIn,
    checkOut: "x",
    nights: 2 + addedNights,
    shiftDays,
    addedNights,
    count,
  });

  it("keeps only windows that beat the current count", () => {
    expect(rankFlexibleWindows([w("2026-11-09", -1, 2), w("2026-11-11", 1, 1)], 2)).toEqual([]);
  });

  it("orders by count, then closeness, same length first, then earlier date; respects limit", () => {
    const ranked = rankFlexibleWindows(
      [
        w("2026-11-13", 3, 5),
        w("2026-11-09", -1, 5),
        w("2026-11-11", 1, 5),
        w("2026-11-08", -2, 7),
        w("2026-11-10", 0, 5, 1),
        w("2026-11-12", 2, 3),
      ],
      1,
      4,
    );
    expect(ranked.map((r) => `${r.checkIn}:${r.count}`)).toEqual([
      "2026-11-08:7",
      "2026-11-09:5", // same length, 1 day earlier
      "2026-11-11:5", // same length, 1 day later
      "2026-11-10:5", // +1 night (same distance; same-length shifts first)
    ]);
  });
});

describe("labels and URLs", () => {
  it("formats chip date ranges", () => {
    expect(formatWindowLabel("2026-11-06", "2026-11-08")).toBe("Nov 6–8");
    expect(formatWindowLabel("2026-11-30", "2026-12-02")).toBe("Nov 30–Dec 2");
    expect(formatWindowLabel("2026-12-30", "2027-01-02")).toBe("Dec 30–Jan 2");
  });

  it("formats counts", () => {
    expect(formatStayCount(1)).toBe("1 stay");
    expect(formatStayCount(5)).toBe("5 stays");
    // Never capped at the page size; "+" only at the 200-stay pool cap.
    expect(formatStayCount(8)).toBe("8 stays");
    expect(formatStayCount(199, 200)).toBe("199 stays");
    expect(formatStayCount(200, 200)).toBe("200+ stays");
    expect(formatStayCount(200)).toBe("200 stays");
  });

  it("builds clean marketplace URLs", () => {
    expect(marketplaceSearchPath({}, "2026-11-06", "2026-11-08")).toBe(
      "/marketplace?checkIn=2026-11-06&checkOut=2026-11-08",
    );
    expect(
      marketplaceSearchPath({ where: " Lake Lure ", guests: 4, pets: 0 }, "2026-11-06", "2026-11-08"),
    ).toBe("/marketplace?where=Lake+Lure&checkIn=2026-11-06&checkOut=2026-11-08&guests=4");
  });

  it("keeps amenities and the other filters on suggestion links", () => {
    expect(
      marketplaceSearchPath(
        {
          where: "Malakoff",
          guests: 2,
          pets: 1,
          remember: "dock",
          filters: { bedrooms: 2, minNightly: 100, maxNightly: 300, amenities: ["lake_view", "wifi"] },
        },
        "2026-11-06",
        "2026-11-08",
      ),
    ).toBe(
      "/marketplace?where=Malakoff&checkIn=2026-11-06&checkOut=2026-11-08&guests=2&pets=1&remember=dock&bedrooms=2&minNightly=100&maxNightly=300&amenities=lake_view%2Cwifi",
    );
  });

  it("carries filters into computeFlexibleDates suggestion URLs", () => {
    const out = computeFlexibleDates({
      pool: [
        listing({ id: "a", blocks: [{ start: d("2026-11-06"), end: d("2026-11-08") }] }),
        listing({ id: "b", blocks: [{ start: d("2026-11-06"), end: d("2026-11-08") }] }),
      ],
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      today: "2026-11-01",
      context: { where: "Malakoff", filters: { amenities: ["lake_view"] } },
    });
    expect(out!.suggestions.length).toBeGreaterThan(0);
    for (const s of out!.suggestions) expect(s.searchPath).toContain("amenities=lake_view");
  });
});

describe("computeFlexibleDates", () => {
  const today = "2026-11-01";

  it("suggests a 2-night window and the min-stay note for a 1-night search", () => {
    const pool = [
      listing({ id: "a" }),
      listing({ id: "b", defaultMinNights: 2 }),
      listing({ id: "c", defaultMinNights: 2 }),
    ];
    const out = computeFlexibleDates({
      pool,
      checkIn: "2026-11-06",
      checkOut: "2026-11-07",
      today,
      context: { where: "Lake Lure" },
    });
    expect(out).not.toBeNull();
    expect(out!.currentCount).toBe(1);
    expect(out!.minStay).toEqual({ count: 2, minNights: 2, message: "Some places need a 2-night minimum" });
    expect(out!.suggestions[0]).toMatchObject({
      checkIn: "2026-11-06",
      checkOut: "2026-11-08",
      count: 3,
      label: "Nov 6–8 · 2 nights · 3 stays",
      searchPath: "/marketplace?where=Lake+Lure&checkIn=2026-11-06&checkOut=2026-11-08",
    });
    expect(out!.suggestions[1]).toMatchObject({ checkIn: "2026-11-05", checkOut: "2026-11-07", count: 3 });
  });

  it("suggests shifted dates when stays are booked", () => {
    const booked = { start: d("2026-11-10"), end: d("2026-11-12") };
    const pool = [listing({ id: "a" }), listing({ id: "b", blocks: [booked] }), listing({ id: "c", blocks: [booked] })];
    const out = computeFlexibleDates({ pool, checkIn: "2026-11-10", checkOut: "2026-11-12", today });
    expect(out!.minStay).toBeNull();
    expect(out!.suggestions.length).toBeLessThanOrEqual(4);
    expect(out!.suggestions[0]).toMatchObject({ checkIn: "2026-11-08", checkOut: "2026-11-10", count: 3, label: "Nov 8–10 · 3 stays" });
  });

  it("returns null when nothing beats the current count", () => {
    const pool = [listing({ id: "a", blocks: [{ start: d("2026-11-01"), end: d("2026-12-01") }] })];
    expect(computeFlexibleDates({ pool, checkIn: "2026-11-10", checkOut: "2026-11-12", today })).toBeNull();
  });

  it("returns null when results are not limited", () => {
    const pool = ["a", "b", "c", "d"].map((id) => listing({ id }));
    expect(computeFlexibleDates({ pool, checkIn: "2026-11-10", checkOut: "2026-11-12", today })).toBeNull();
  });

  it("returns null without valid dates or listings", () => {
    expect(computeFlexibleDates({ pool: [], checkIn: "2026-11-10", checkOut: "2026-11-12", today })).toBeNull();
    expect(computeFlexibleDates({ pool: [listing()], checkIn: "2026-11-12", checkOut: "2026-11-10", today })).toBeNull();
  });
});

describe("suggestion labels ignore the page size", () => {
  const today = "2026-11-01";
  const booked = { start: d("2026-11-10"), end: d("2026-11-11") };

  it("reads the full window count ('8 stays', not '2+')", () => {
    const pool = Array.from({ length: 8 }, (_, i) =>
      listing({ id: `p${i}`, blocks: i < 7 ? [booked] : [] }),
    );
    const out = computeFlexibleDates({ pool, checkIn: "2026-11-10", checkOut: "2026-11-11", today });
    expect(out!.suggestions[0]).toMatchObject({ count: 8, label: "Nov 9–10 · 8 stays" });
  });

  it("uses '+' only at the 200-stay pool cap", () => {
    const pool = Array.from({ length: 200 }, (_, i) =>
      listing({ id: `p${i}`, blocks: i === 0 ? [booked] : [] }),
    );
    const capped = computeFlexibleDates({
      pool,
      checkIn: "2026-11-10",
      checkOut: "2026-11-11",
      today,
      poolCap: 200,
    });
    expect(capped!.suggestions[0]).toMatchObject({ count: 200, label: "Nov 9–10 · 200+ stays" });
    const uncapped = computeFlexibleDates({ pool, checkIn: "2026-11-10", checkOut: "2026-11-11", today });
    expect(uncapped!.suggestions[0].label).toBe("Nov 9–10 · 200 stays");
  });
});
