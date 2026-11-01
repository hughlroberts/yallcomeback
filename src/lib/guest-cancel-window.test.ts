import { describe, expect, it } from "vitest";
import {
  guestCancelWindow,
  onlineCancelLines,
  shortRuleText,
  zonedTime,
} from "./guest-cancel-window";

const DAY = 24 * 60 * 60 * 1000;
// Stored like createBooking does: local midnight of the check-in day.
const checkIn = new Date("2026-12-20T00:00:00");
const checkInAt = zonedTime("2026-12-20", "16:00"); // 4 PM Central
const base = {
  nights: 3,
  checkIn,
  checkInTime: "16:00",
  createdAt: new Date(checkInAt.getTime() - 60 * DAY),
};

describe("zonedTime", () => {
  it("reads wall-clock time in America/Chicago (CST and CDT)", () => {
    expect(zonedTime("2026-12-20", "16:00").toISOString()).toBe(
      "2026-12-20T22:00:00.000Z",
    );
    expect(zonedTime("2026-07-04", "16:00").toISOString()).toBe(
      "2026-07-04T21:00:00.000Z",
    );
  });
});

describe("guestCancelWindow (short stays)", () => {
  it("Moderate: online until 5 days before check-in, full refund tier", () => {
    const w = (now: number) =>
      guestCancelWindow({
        ...base,
        cancellationPolicy: "MODERATE",
        now: new Date(now),
      });
    expect(w(checkInAt.getTime() - 5 * DAY).deadline.getTime()).toBe(
      checkInAt.getTime() - 5 * DAY,
    );
    const before = w(checkInAt.getTime() - 5 * DAY - 1000);
    expect(before.canCancelOnline).toBe(true);
    expect(before.refundTier).toBe("full");
    const after = w(checkInAt.getTime() - 5 * DAY + 1000);
    expect(after.canCancelOnline).toBe(false);
    expect(after.refundTier).toBe("none");
  });

  it("Flexible: until 24 hours before check-in", () => {
    const ok = guestCancelWindow({
      ...base,
      cancellationPolicy: "FLEXIBLE",
      now: new Date(checkInAt.getTime() - 25 * 60 * 60 * 1000),
    });
    expect(ok.canCancelOnline).toBe(true);
    const late = guestCancelWindow({
      ...base,
      cancellationPolicy: "FLEXIBLE",
      now: new Date(checkInAt.getTime() - 23 * 60 * 60 * 1000),
    });
    expect(late.canCancelOnline).toBe(false);
  });

  it("Firm: full until 30 days, partial until 7 days, then contact host", () => {
    const at = (d: number) =>
      guestCancelWindow({
        ...base,
        cancellationPolicy: "FIRM",
        now: new Date(checkInAt.getTime() - d * DAY),
      });
    expect(at(31).refundTier).toBe("full");
    expect(at(10).refundTier).toBe("partial");
    expect(at(10).canCancelOnline).toBe(true);
    expect(at(6).canCancelOnline).toBe(false);
  });

  it("Super Strict 60: online until 60 days before", () => {
    const w = guestCancelWindow({
      ...base,
      createdAt: new Date(checkInAt.getTime() - 90 * DAY),
      cancellationPolicy: "SUPER_FIRM_60",
      now: new Date(checkInAt.getTime() - 59 * DAY),
    });
    expect(w.canCancelOnline).toBe(false);
  });

  it("24-hour free window after booking (booked 7+ days ahead)", () => {
    const createdAt = new Date(checkInAt.getTime() - 20 * DAY);
    const w = guestCancelWindow({
      ...base,
      createdAt,
      cancellationPolicy: "SUPER_FIRM_30",
      now: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
    });
    expect(w.canCancelOnline).toBe(true);
    expect(w.refundTier).toBe("full");
    const nextDay = guestCancelWindow({
      ...base,
      createdAt,
      cancellationPolicy: "SUPER_FIRM_30",
      now: new Date(createdAt.getTime() + 25 * 60 * 60 * 1000),
    });
    expect(nextDay.canCancelOnline).toBe(false);
  });

  it("no 24-hour window when booked less than 7 days ahead", () => {
    const createdAt = new Date(checkInAt.getTime() - 3 * DAY);
    const w = guestCancelWindow({
      ...base,
      createdAt,
      cancellationPolicy: "STRICT",
      now: new Date(createdAt.getTime() + 60 * 1000),
    });
    expect(w.canCancelOnline).toBe(false);
  });

  it("unknown policy falls back to Moderate", () => {
    const w = guestCancelWindow({ ...base, cancellationPolicy: "NOPE" });
    expect(w.policyName).toMatch(/Moderate/i);
  });
});

describe("guestCancelWindow (monthly stays)", () => {
  it("Firm: until 30 days before check-in", () => {
    const w = guestCancelWindow({
      ...base,
      nights: 30,
      longTermCancellationPolicy: "FIRM",
      now: new Date(checkInAt.getTime() - 31 * DAY),
    });
    expect(w.canCancelOnline).toBe(true);
    expect(w.deadline.getTime()).toBe(checkInAt.getTime() - 30 * DAY);
  });

  it("Strict: only within 48h of booking and 28+ days out", () => {
    const createdAt = new Date(checkInAt.getTime() - 40 * DAY);
    const at = (h: number) =>
      guestCancelWindow({
        ...base,
        nights: 30,
        createdAt,
        longTermCancellationPolicy: "STRICT",
        now: new Date(createdAt.getTime() + h * 60 * 60 * 1000),
      });
    expect(at(47).canCancelOnline).toBe(true);
    expect(at(49).canCancelOnline).toBe(false);
  });
});

describe("policy text", () => {
  it("says when online cancel ends and that refunds are not automatic", () => {
    expect(shortRuleText("MODERATE")).toBe(
      "You can cancel online until 5 days before check-in. After that, contact the host to cancel.",
    );
    expect(shortRuleText("FLEXIBLE")).toContain("24 hours before check-in");
    const lines = onlineCancelLines("short", "FIRM");
    expect(lines[0]).toContain("7 days before check-in");
    expect(lines[1]).toMatch(/Refunds are not automatic/);
    expect(onlineCancelLines("long", "FIRM")[0]).toContain("30 days");
  });
});
