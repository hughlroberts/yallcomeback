import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("booking widget: nothing above the calendar depends on the dates", () => {
  it("min-nights line uses the listing default; holiday minimum sits below the calendar", () => {
    const src = readFileSync(
      path.join(__dirname, "booking-widget.tsx"),
      "utf8",
    );
    const above = src.slice(
      src.indexOf('id="reserve"'),
      src.indexOf("<AvailabilityCalendar"),
    );
    expect(above).not.toMatch(/checkIn|checkOut|quote|specialMinNights/);
    const below = src.slice(src.indexOf("<AvailabilityCalendar"));
    expect(below).toContain("specialMinNights");
  });
});
