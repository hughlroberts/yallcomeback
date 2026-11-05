import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import {
  AvailabilityCalendar,
  calendarDayAriaLabel,
  nextDateSelection,
  shortRangeLabel,
} from "./availability-calendar";

const blocked = new Set(["2026-11-25"]);
const today = "2026-10-31";

function render(props: Record<string, unknown>) {
  return renderToString(
    createElement(AvailabilityCalendar, {
      blockedDates: [...blocked],
      compact: true,
      selectable: true,
      monthsToShow: 2,
      todayYmd: today,
      onChange: () => {},
      ...props,
    }),
  );
}

const months = (html: string) =>
  [
    ...html.matchAll(
      /(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/g,
    ),
  ].map((m) => m[0]);

describe("listing calendar stays put between taps", () => {
  const origTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = origTz;
  });

  it("tapping a date never moves the visible months", () => {
    // Tapping Nov 20 in the second month used to scroll November to the top,
    // so the next tap on Nov 23 landed on Dec 21.
    const src = readFileSync(
      path.join(__dirname, "availability-calendar.tsx"),
      "utf8",
    );
    const body = src.slice(
      src.indexOf("function handleDayClick"),
      src.indexOf("\n  }\n", src.indexOf("function handleDayClick")),
    );
    expect(body).toContain("nextDateSelection");
    expect(body).not.toContain("setCursor");
  });

  it("always renders both months; phones hide the second with CSS only", () => {
    const html = render({});
    expect(months(html)).toHaveLength(2);
    expect(html).toContain("hidden min-[480px]:block");
  });

  it("server and browser render the same markup in any time zone", () => {
    const out = ["UTC", "America/Chicago", "Asia/Tokyo"].map((tz) => {
      process.env.TZ = tz;
      return render({ checkIn: "2026-11-20", checkOut: "2026-11-23" });
    });
    expect(out[1]).toBe(out[0]);
    expect(out[2]).toBe(out[0]);
  });
});

describe("nextDateSelection", () => {
  const base = {
    checkIn: "",
    checkOut: "",
    blocked,
    today,
    unavailableNight: false,
  };

  it("first tap sets check-in, second sets check-out", () => {
    const first = nextDateSelection({ ...base, key: "2026-11-20" });
    expect(first).toEqual({ checkIn: "2026-11-20", checkOut: "" });
    expect(
      nextDateSelection({ ...base, ...first!, key: "2026-11-23" }),
    ).toEqual({ checkIn: "2026-11-20", checkOut: "2026-11-23" });
  });

  it("ignores past days and ranges over a blocked night", () => {
    expect(nextDateSelection({ ...base, key: "2026-10-30" })).toBeNull();
    expect(
      nextDateSelection({ ...base, checkIn: "2026-11-20", key: "2026-11-27" }),
    ).toBeNull();
  });

  it("checkout may land on a blocked day if the nights are free", () => {
    expect(
      nextDateSelection({ ...base, checkIn: "2026-11-20", key: "2026-11-25" }),
    ).toEqual({ checkIn: "2026-11-20", checkOut: "2026-11-25" });
  });

  it("tapping check-in again clears; an earlier free day restarts", () => {
    expect(
      nextDateSelection({ ...base, checkIn: "2026-11-20", key: "2026-11-20" }),
    ).toEqual({ checkIn: "", checkOut: "" });
    expect(
      nextDateSelection({ ...base, checkIn: "2026-11-20", key: "2026-11-18" }),
    ).toEqual({ checkIn: "2026-11-18", checkOut: "" });
  });
});

describe("compact header never changes height between taps", () => {
  const header = (html: string) =>
    html.match(/<div[^>]*data-calendar-header[^>]*>/)?.[0] ?? "";

  it.each([
    [{}, "Select check-in"],
    [{ checkIn: "2026-11-10" }, "Select checkout"],
    [{ checkIn: "2026-11-10", checkOut: "2026-11-13" }, "Nov 10 → Nov 13"],
  ])("state %j shows %s in a one-row, fixed-height header", (state, label) => {
    const html = render(state);
    const h = header(html);
    expect(h).toContain("h-10");
    expect(h).toContain("flex-nowrap");
    expect(h).not.toContain("flex-wrap ");
    expect(html).toContain(label);
    expect(html).toMatch(/<p class="truncate text-\[11px\][^"]*"[^>]*>/);
  });

  it("uses a short range label, with years only across a new year", () => {
    expect(shortRangeLabel("2026-11-10", "2026-11-13")).toBe("Nov 10 → Nov 13");
    expect(shortRangeLabel("2026-12-30", "2027-01-02")).toBe(
      "Dec 30, 2026 → Jan 2, 2027",
    );
  });
});

describe("E1104-C2 calendar day a11y", () => {
  it("names days with the full date and status", () => {
    const d = new Date(2026, 10, 7); // Sat Nov 7, 2026 local
    expect(calendarDayAriaLabel(d, "available")).toMatch(
      /Saturday, Nov 7, 2026, available/,
    );
    expect(calendarDayAriaLabel(d, "unavailable")).toMatch(/unavailable$/);
  });

  it("renders grid semantics and aria-labels on day cells", () => {
    const html = render({ checkIn: "2026-11-20", checkOut: "2026-11-23" });
    expect(html).toContain('role="grid"');
    expect(html).toContain('role="row"');
    expect(html).toContain('role="gridcell"');
    expect(html).toContain('role="columnheader"');
    expect(html).toMatch(/aria-label="[^"]*available"/);
    expect(html).toMatch(/aria-label="[^"]*check-in"/);
  });
});
