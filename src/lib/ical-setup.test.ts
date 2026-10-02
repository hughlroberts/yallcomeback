import { describe, expect, it } from "vitest";
import { parseIcalEvents } from "@/lib/ical";
import {
  extractIcalUrlsFromText,
  guessIcalSourceName,
  isOwnYcbExportUrl,
  looksLikeIcalFeedUrl,
  looksLikeOtaListingPage,
  parseLlmUrlJson,
} from "@/lib/ical-setup";

describe("extractIcalUrlsFromText", () => {
  it("accepts a clean Airbnb ICS URL", () => {
    const url =
      "https://www.airbnb.com/calendar/ical/12345678.ics?s=abcdef123456";
    expect(extractIcalUrlsFromText(url)).toEqual([url]);
  });

  it("pulls an ICS URL out of messy host-settings paste", () => {
    const paste = `
      Export calendar
      Copy this link:
      https://www.airbnb.com/calendar/ical/999.ics?s=secret_token
      Then import the other calendar.
    `;
    expect(extractIcalUrlsFromText(paste)).toEqual([
      "https://www.airbnb.com/calendar/ical/999.ics?s=secret_token",
    ]);
  });

  it("finds a VRBO icalendar URL among other links", () => {
    const paste = [
      "Listing https://www.vrbo.com/p123456",
      "Feed https://www.vrbo.com/icalendar/abc-def-123.ics",
    ].join("\n");
    expect(extractIcalUrlsFromText(paste)).toEqual([
      "https://www.vrbo.com/icalendar/abc-def-123.ics",
    ]);
  });

  it("ignores public listing pages", () => {
    expect(
      extractIcalUrlsFromText("https://www.airbnb.com/rooms/12345678"),
    ).toEqual([]);
    expect(looksLikeOtaListingPage("https://www.airbnb.com/rooms/12345678")).toBe(
      true,
    );
  });
});

describe("ical URL helpers", () => {
  it("detects feed-shaped URLs", () => {
    expect(
      looksLikeIcalFeedUrl(
        "https://www.airbnb.com/calendar/ical/1.ics?s=x",
      ),
    ).toBe(true);
    expect(
      looksLikeIcalFeedUrl("https://www.vrbo.com/icalendar/token"),
    ).toBe(true);
    expect(looksLikeIcalFeedUrl("https://www.airbnb.com/rooms/1")).toBe(false);
  });

  it("names common OTAs", () => {
    expect(
      guessIcalSourceName("https://www.airbnb.com/calendar/ical/1.ics?s=x"),
    ).toBe("Airbnb");
    expect(guessIcalSourceName("https://www.vrbo.com/icalendar/x")).toBe("VRBO");
    expect(guessIcalSourceName("https://admin.booking.com/hotel/ical")).toBe(
      "Booking.com",
    );
  });

  it("rejects our own export URL as an import", () => {
    expect(
      isOwnYcbExportUrl(
        "https://www.yallcomeback.app/api/ical/prop_abc/secret.ics",
        "prop_abc",
      ),
    ).toBe(true);
    expect(
      isOwnYcbExportUrl(
        "https://www.airbnb.com/calendar/ical/1.ics?s=x",
        "prop_abc",
      ),
    ).toBe(false);
  });

  it("parses LLM JSON even with extra prose", () => {
    const text = `Here you go\n{"urls":["https://www.airbnb.com/calendar/ical/1.ics?s=z"]}\n`;
    expect(parseLlmUrlJson(text)).toEqual([
      "https://www.airbnb.com/calendar/ical/1.ics?s=z",
    ]);
  });
});

describe("parseIcalEvents", () => {
  it("reads busy nights from a minimal ICS", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:stay-1@example.com",
      "DTSTART;VALUE=DATE:20261010",
      "DTEND;VALUE=DATE:20261012",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const events = parseIcalEvents(ics);
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toBe("Reserved");
    expect(events[0]?.start.toISOString().slice(0, 10)).toBe("2026-10-10");
  });
});
