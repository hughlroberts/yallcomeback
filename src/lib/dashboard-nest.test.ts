import { describe, expect, it } from "vitest";
import {
  dashboardNestActive,
  isDashboardNestPath,
} from "@/lib/dashboard-nest";

describe("dashboardNestActive", () => {
  it("treats the dashboard overview as the nest home", () => {
    expect(dashboardNestActive("/admin")).toBe("dashboard");
    expect(dashboardNestActive("/admin/")).toBe("dashboard");
  });

  it("keeps Brand, Payments, templates, and Team in the nest", () => {
    expect(dashboardNestActive("/admin/brand")).toBe("brand");
    expect(dashboardNestActive("/admin/payments")).toBe("payments");
    expect(dashboardNestActive("/admin/guest-messages")).toBe("templates");
    expect(dashboardNestActive("/admin/team")).toBe("team");
  });

  it("keeps Earnings inner pages (including Tax records) on Earnings", () => {
    expect(dashboardNestActive("/admin/earnings")).toBe("earnings");
    expect(dashboardNestActive("/admin/earnings/performance")).toBe(
      "earnings",
    );
    expect(dashboardNestActive("/admin/earnings/paid")).toBe("earnings");
    expect(dashboardNestActive("/admin/taxes")).toBe("earnings");
  });

  it("does not steal Calendar, Listings, Messages, or Bookings", () => {
    expect(isDashboardNestPath("/admin/calendar")).toBe(false);
    expect(isDashboardNestPath("/admin/properties")).toBe(false);
    expect(isDashboardNestPath("/admin/properties/abc")).toBe(false);
    expect(isDashboardNestPath("/admin/messages")).toBe(false);
    expect(isDashboardNestPath("/admin/bookings")).toBe(false);
    expect(isDashboardNestPath("/admin/hosting")).toBe(false);
  });
});
