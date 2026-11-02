import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  pageView: { findMany: vi.fn(async () => [] as unknown[]) },
  analyticsEvent: { findMany: vi.fn(async () => [] as unknown[]) },
  user: { findMany: vi.fn<(args?: unknown) => Promise<{ id: string }[]>>(async () => []) },
  booking: { findMany: vi.fn<(args?: unknown) => Promise<{ id: string }[]>>(async () => []) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { buildAnalyticsStats } from "@/lib/analytics-stats";

const at = new Date("2026-10-05T12:00:00.000Z");
const ev = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  utmSource: null,
  value: null,
  createdAt: at,
  bookingId: null,
  userId: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.analyticsEvent.findMany.mockResolvedValue([
    ev("guest_signup_completed", { userId: "u_real" }),
    ev("guest_signup_completed", { userId: "u_team" }),
    ev("host_signup_completed", { userId: "u_flagged" }),
    ev("host_signup_completed"),
    ev("booking_started", { bookingId: "b_real" }),
    ev("booking_completed", { bookingId: "b_real", value: 300 }),
    ev("booking_started", { bookingId: "b_team" }),
    ev("booking_completed", { bookingId: "b_team", value: 999 }),
  ]);
  db.user.findMany.mockResolvedValue([{ id: "u_team" }, { id: "u_flagged" }]);
  db.booking.findMany.mockResolvedValue([{ id: "b_team" }]);
});
afterEach(() => vi.unstubAllEnvs());

describe("stats API leaves out internal accounts", () => {
  it("drops signups and bookings by isInternal or excluded-email users", async () => {
    vi.stubEnv("ANALYTICS_EXCLUDE_EMAILS", "Team@X.co");
    const r = await buildAnalyticsStats("2026-10-05", "2026-10-05");
    if ("error" in r) throw new Error(r.error);

    expect(r.guestSignups.count).toBe(1);
    expect(r.hostSignups.count).toBe(1);
    expect(r.bookings).toEqual({
      count: 1,
      revenue: 300,
      byUtmSource: { "(none)": { count: 1, revenue: 300 } },
    });
    expect(r.funnel.counts.booking_started).toBe(1);
    expect(r.daily[0]).toMatchObject({ guestSignups: 1, hostSignups: 1 });

    const userWhere = JSON.stringify(db.user.findMany.mock.calls[0]?.[0]);
    expect(userWhere).toContain('"isInternal":true');
    expect(userWhere).toContain('"equals":"team@x.co","mode":"insensitive"');
    const bookingWhere = JSON.stringify(db.booking.findMany.mock.calls[0]?.[0]);
    expect(bookingWhere).toContain('"in":["b_real","b_team"]');
    expect(bookingWhere).toContain('"guestEmail":{"equals":"team@x.co"');
  });

  it("keeps the response shape", async () => {
    const r = await buildAnalyticsStats("2026-10-05", "2026-10-05");
    if ("error" in r) throw new Error(r.error);
    expect(Object.keys(r)).toEqual([
      "from",
      "to",
      "daily",
      "topPages",
      "topReferrers",
      "topUtmSources",
      "funnel",
      "bookings",
      "guestSignups",
      "hostSignups",
    ]);
    expect(Object.keys(r.funnel)).toEqual(["counts", "byUtmSource", "conversionRates"]);
    expect(Object.keys(r.bookings)).toEqual(["count", "revenue", "byUtmSource"]);
    expect(Object.keys(r.guestSignups)).toEqual([
      "started",
      "count",
      "conversionRate",
      "byUtmSource",
    ]);
    expect(Object.keys(r.daily[0]!)).toEqual([
      "date",
      "visitors",
      "pageViews",
      "guestSignups",
      "hostSignups",
    ]);
  });
});
