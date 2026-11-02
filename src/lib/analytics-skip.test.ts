import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SessionUser = { id: string; role: string; email?: string | null };
const state = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  session: null as { user: SessionUser } | null,
}));
const db = vi.hoisted(() => ({
  pageView: { create: vi.fn(async () => ({})) },
  analyticsEvent: {
    create: vi.fn(async () => ({})),
    findFirst: vi.fn(async () => null),
  },
  user: {
    findUnique: vi.fn<(...a: unknown[]) => Promise<{ email: string; isInternal: boolean } | null>>(
      async () => null,
    ),
  },
  booking: {
    findUnique: vi.fn<
      (...a: unknown[]) => Promise<{
        guestEmail: string;
        user: { email: string; isInternal: boolean; role: string } | null;
      } | null>
    >(async () => null),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => state.session) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (k in state.cookies ? { value: state.cookies[k] } : undefined),
    set: () => {},
  }),
  headers: async () => new Headers({ "user-agent": "Mozilla/5.0" }),
}));

import { recordAnalyticsEvent, recordPageView } from "@/lib/analytics";

const VID = "0b6f1c3e-1a2b-4c3d-8e4f-123456789abc";
const view = () => recordPageView({ path: "/help", userAgent: "Mozilla/5.0" });

beforeEach(() => {
  vi.clearAllMocks();
  state.cookies = { ycb_vid: VID };
  state.session = null;
});
afterEach(() => vi.unstubAllEnvs());

describe("page views skip internal traffic", () => {
  it("records a normal logged-out visitor", async () => {
    await expect(view()).resolves.toEqual({ ok: true });
    expect(db.pageView.create).toHaveBeenCalledTimes(1);
  });

  it("skips a browser with the ycb_internal cookie, even logged out", async () => {
    state.cookies.ycb_internal = "1";
    await expect(view()).resolves.toEqual({ ok: true, skipped: "internal" });
    expect(db.pageView.create).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "HOST"])("skips a signed-in %s", async (role) => {
    state.session = { user: { id: "u1", role, email: "x@y.co" } };
    await expect(view()).resolves.toEqual({ ok: true, skipped: "internal" });
    expect(db.pageView.create).not.toHaveBeenCalled();
  });

  it("skips a guest whose email is in ANALYTICS_EXCLUDE_EMAILS", async () => {
    vi.stubEnv("ANALYTICS_EXCLUDE_EMAILS", " Team@Example.com ");
    state.session = { user: { id: "u1", role: "GUEST", email: "team@example.COM" } };
    await expect(view()).resolves.toEqual({ ok: true, skipped: "internal" });
  });

  it("skips a guest flagged isInternal, records an ordinary guest", async () => {
    state.session = { user: { id: "u1", role: "GUEST", email: "g@x.co" } };
    db.user.findUnique.mockResolvedValueOnce({ email: "g@x.co", isInternal: true });
    await expect(view()).resolves.toEqual({ ok: true, skipped: "internal" });

    db.user.findUnique.mockResolvedValueOnce({ email: "g@x.co", isInternal: false });
    await expect(view()).resolves.toEqual({ ok: true });
    expect(db.pageView.create).toHaveBeenCalledTimes(1);
  });
});

describe("events skip internal traffic", () => {
  it("skips visitor events from an internal browser", async () => {
    state.cookies.ycb_internal = "1";
    await recordAnalyticsEvent({ name: "listing_view", listingId: "p1" });
    await recordAnalyticsEvent({ name: "guest_signup_started", path: "/register" });
    expect(db.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it("stores the new account id on a signup, and skips excluded emails", async () => {
    db.user.findUnique.mockResolvedValueOnce({ email: "new@x.co", isInternal: false });
    await recordAnalyticsEvent({ name: "guest_signup_completed", userId: "u_new" });
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);
    expect(db.analyticsEvent.create.mock.calls[0]).toMatchObject([
      { data: { name: "guest_signup_completed", userId: "u_new" } },
    ]);

    vi.stubEnv("ANALYTICS_EXCLUDE_EMAILS", "team@x.co");
    db.user.findUnique.mockResolvedValueOnce({ email: "Team@x.co", isInternal: false });
    await recordAnalyticsEvent({ name: "host_signup_completed", userId: "u_team" });
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);
  });

  it("does not drop a real host signup because the session now shows HOST", async () => {
    state.session = { user: { id: "u_new", role: "HOST", email: "new@x.co" } };
    db.user.findUnique.mockResolvedValue({ email: "new@x.co", isInternal: false });
    await recordAnalyticsEvent({ name: "host_signup_completed", userId: "u_new" });
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);
  });

  it("records a guest booking a host confirms, but not an internal account's booking", async () => {
    // Host is signed in and has the internal cookie: booking_completed is about the guest.
    state.session = { user: { id: "h1", role: "HOST" } };
    state.cookies.ycb_internal = "1";
    db.booking.findUnique.mockResolvedValueOnce({
      guestEmail: "guest@x.co",
      user: { email: "guest@x.co", isInternal: false, role: "GUEST" },
    });
    await recordAnalyticsEvent({ name: "booking_completed", bookingId: "b1", value: 100 });
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);

    db.booking.findUnique.mockResolvedValueOnce({
      guestEmail: "guest@x.co",
      user: { email: "guest@x.co", isInternal: true, role: "GUEST" },
    });
    await recordAnalyticsEvent({ name: "booking_completed", bookingId: "b2", value: 100 });
    vi.stubEnv("ANALYTICS_EXCLUDE_EMAILS", "tester@x.co");
    db.booking.findUnique.mockResolvedValueOnce({ guestEmail: "TESTER@x.co", user: null });
    await recordAnalyticsEvent({ name: "booking_cancelled", bookingId: "b3" });
    expect(db.analyticsEvent.create).toHaveBeenCalledTimes(1);
  });
});
