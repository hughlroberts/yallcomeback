import { describe, expect, it } from "vitest";
import { adminBrandSwitchPath } from "./admin-brand-path";

describe("adminBrandSwitchPath", () => {
  it("keeps brand-neutral admin pages", () => {
    expect(adminBrandSwitchPath("/admin/properties")).toBe("/admin/properties");
    expect(adminBrandSwitchPath("/admin/calendar")).toBe("/admin/calendar");
    expect(adminBrandSwitchPath("/admin/bookings")).toBe("/admin/bookings");
    expect(adminBrandSwitchPath("/admin")).toBe("/admin");
  });

  it("drops a listing id from the previous brand", () => {
    expect(adminBrandSwitchPath("/admin/properties/clxyz")).toBe(
      "/admin/properties",
    );
    expect(adminBrandSwitchPath("/admin/properties/clxyz/setup")).toBe(
      "/admin/properties",
    );
    expect(adminBrandSwitchPath("/admin/magnets/clxyz")).toBe(
      "/admin/properties",
    );
  });

  it("strips query strings on property URLs", () => {
    expect(adminBrandSwitchPath("/admin/properties/clxyz?tab=sync")).toBe(
      "/admin/properties",
    );
  });

  it("rejects non-admin paths", () => {
    expect(adminBrandSwitchPath("/marketplace")).toBe("/admin/calendar");
    expect(adminBrandSwitchPath("")).toBe("/admin/calendar");
  });
});
