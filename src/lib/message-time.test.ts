import { describe, expect, it } from "vitest";
import {
  conversationListDateLabel,
  messageDayKey,
  messageDayLabel,
  messageTimeLabel,
} from "@/lib/message-time";

// 15:55 UTC on Mon Nov 2, 2026 = 9:55 AM Central (UTC-6).
const SENT = new Date("2026-11-02T15:55:46Z");

describe("message time labels", () => {
  it("renders in the given zone, not UTC", () => {
    expect(messageTimeLabel(SENT, "America/Chicago")).toBe("9:55 AM");
    expect(messageTimeLabel(SENT, "America/Los_Angeles")).toBe("7:55 AM");
    expect(messageTimeLabel(SENT, "UTC")).toBe("3:55 PM");
  });

  it("uses the zone's calendar day for dividers", () => {
    // 03:00 UTC Nov 3 is still Nov 2 in Chicago.
    const late = new Date("2026-11-03T03:00:00Z");
    expect(messageDayKey(late, "UTC")).toBe("2026-11-03");
    expect(messageDayKey(late, "America/Chicago")).toBe("2026-11-02");
    const now = new Date("2026-11-03T04:00:00Z");
    expect(messageDayLabel(late, now, "America/Chicago")).toBe("Today");
    expect(messageDayLabel(SENT, now, "UTC")).toBe("Yesterday");
    expect(
      messageDayLabel(new Date("2026-10-28T18:00:00Z"), now, "America/Chicago"),
    ).toBe("Wednesday, Oct 28");
  });

  it("formats the conversation list date", () => {
    const now = new Date("2026-11-02T18:00:00Z");
    expect(conversationListDateLabel(SENT, now, "America/Chicago")).toBe("11/2");
    expect(
      conversationListDateLabel(new Date("2026-11-01T18:00:00Z"), now, "America/Chicago"),
    ).toBe("Yesterday");
    expect(
      conversationListDateLabel(new Date("2026-10-29T18:00:00Z"), now, "America/Chicago"),
    ).toBe("Thu");
    expect(
      conversationListDateLabel(new Date("2026-10-20T18:00:00Z"), now, "America/Chicago"),
    ).toBe("10/20");
  });
});
