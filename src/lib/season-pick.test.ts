import { describe, expect, it } from "vitest";
import { pickSeasonForNight } from "./season-pick";
import { calculateQuote } from "./pricing";

const day = (s: string) => new Date(`${s}T00:00:00`);
const range = (s: { startDate: Date; endDate: Date }) => ({
  start: s.startDate.getTime(),
  end: s.endDate.getTime(),
});

describe("pickSeasonForNight", () => {
  const summer = {
    name: "Summer",
    startDate: day("2026-06-01"),
    endDate: day("2026-08-31"),
    nightlyRate: 250,
    minNights: 3,
  };
  const oneNight = {
    name: "Custom price",
    startDate: day("2026-07-04"),
    endDate: day("2026-07-04"),
    nightlyRate: 400,
    minNights: 1,
  };

  it("prefers the shortest overlapping range, in any order", () => {
    expect(
      pickSeasonForNight(
        day("2026-07-04").getTime(),
        [summer, oneNight],
        range,
      ),
    ).toBe(oneNight);
    expect(
      pickSeasonForNight(
        day("2026-07-04").getTime(),
        [oneNight, summer],
        range,
      ),
    ).toBe(oneNight);
  });
  it("falls back to the broader season on other nights", () => {
    expect(
      pickSeasonForNight(
        day("2026-07-05").getTime(),
        [oneNight, summer],
        range,
      ),
    ).toBe(summer);
  });
  it("returns null outside every range", () => {
    expect(
      pickSeasonForNight(day("2026-09-05").getTime(), [summer], range),
    ).toBeNull();
  });

  it("the quote uses a night price set inside a season", () => {
    const q = calculateQuote({
      property: {
        baseNightlyRate: 150,
        defaultMinNights: 1,
        cleaningFee: 0,
        petFee: 0,
        petsAllowed: false,
        depositPercent: 100,
      },
      seasons: [summer, oneNight],
      checkIn: day("2026-07-07"),
      checkOut: day("2026-07-08"),
      taxLines: [],
    } as unknown as Parameters<typeof calculateQuote>[0]);
    expect(q.nightlyBreakdown[0]!.rate).toBe(250);
    const q2 = calculateQuote({
      property: {
        baseNightlyRate: 150,
        defaultMinNights: 1,
        cleaningFee: 0,
        petFee: 0,
        petsAllowed: false,
        depositPercent: 100,
      },
      seasons: [summer, oneNight],
      checkIn: day("2026-07-08"),
      checkOut: day("2026-07-09"),
      taxLines: [],
    } as unknown as Parameters<typeof calculateQuote>[0]);
    expect(q2.nightlyBreakdown[0]!.seasonName).toBe("Summer");
  });
});
