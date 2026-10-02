import { describe, expect, it } from "vitest";
import { homeAfterLogin } from "@/lib/login-home";

describe("homeAfterLogin", () => {
  it("sends hosts to Calendar from the homepage or a bare login", () => {
    expect(homeAfterLogin("HOST", "/")).toBe("/admin/calendar");
    expect(homeAfterLogin("HOST")).toBe("/admin/calendar");
    expect(homeAfterLogin("ADMIN", "/login")).toBe("/admin/calendar");
    expect(homeAfterLogin("HOST", "/for-hosts")).toBe("/admin/calendar");
    expect(homeAfterLogin("HOST", "/marketplace")).toBe("/admin/calendar");
    expect(homeAfterLogin("HOST", "/forgot-password")).toBe("/admin/calendar");
    expect(homeAfterLogin("HOST", "/verify-email")).toBe("/admin/calendar");
  });

  it("sends a bare /admin callback to Calendar, not the dashboard", () => {
    expect(homeAfterLogin("HOST", "/admin")).toBe("/admin/calendar");
    expect(homeAfterLogin("ADMIN", "/admin")).toBe("/admin/calendar");
  });

  it("keeps host deep links into admin, ops, and account", () => {
    expect(homeAfterLogin("HOST", "/admin/bookings")).toBe("/admin/bookings");
    expect(homeAfterLogin("ADMIN", "/ops")).toBe("/ops");
    expect(
      homeAfterLogin("HOST", "/account/settings/subscription?welcome=1"),
    ).toBe("/account/settings/subscription?welcome=1");
  });

  it("sends guests to Find a Place from generic landings", () => {
    expect(homeAfterLogin("GUEST", "/")).toBe("/marketplace");
    expect(homeAfterLogin("GUEST")).toBe("/marketplace");
    expect(homeAfterLogin(undefined, "/login")).toBe("/marketplace");
    expect(homeAfterLogin("GUEST", "/forgot-password")).toBe("/marketplace");
    expect(homeAfterLogin("GUEST", "/verify-email")).toBe("/marketplace");
  });

  it("keeps a guest on the page they were using", () => {
    expect(
      homeAfterLogin("GUEST", "/marketplace/properties/eagles-nest-suite"),
    ).toBe("/marketplace/properties/eagles-nest-suite");
    expect(homeAfterLogin("GUEST", "/account/bookings")).toBe(
      "/account/bookings",
    );
  });

  it("blocks open redirects", () => {
    expect(homeAfterLogin("GUEST", "https://evil.example")).toBe(
      "/marketplace",
    );
    expect(homeAfterLogin("HOST", "//evil.example")).toBe("/admin/calendar");
  });
});
