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

import { adminHostIdParamRedirect } from "./admin-brand-path";

describe("adminHostIdParamRedirect (T42)", () => {
  const qa = "cmvvd3kt2000hn101yahyc26m";
  const two = "cmqatestertwo00000000000x";
  it("admin with another brand picked: switch to the query brand first", () => {
    const to = adminHostIdParamRedirect({
      pathname: "/admin/brand",
      search: `?hostId=${qa}`,
      role: "ADMIN",
      brandCookie: two,
    });
    expect(to).toBe(
      `/admin/use-brand?${new URLSearchParams({ hostId: qa, to: `/admin/brand?hostId=${qa}` })}`,
    );
  });
  it("same brand already picked: no redirect (no loop)", () => {
    expect(
      adminHostIdParamRedirect({ pathname: "/admin/brand", search: `?hostId=${qa}`, role: "ADMIN", brandCookie: qa }),
    ).toBeNull();
  });
  it("hosts, other areas and bad ids: no redirect", () => {
    const base = { pathname: "/admin/brand", search: `?hostId=${qa}`, brandCookie: two };
    expect(adminHostIdParamRedirect({ ...base, role: "HOST" })).toBeNull();
    expect(adminHostIdParamRedirect({ ...base, role: "ADMIN", pathname: "/account/settings/subscription" })).toBeNull();
    expect(adminHostIdParamRedirect({ ...base, role: "ADMIN", pathname: "/admin/use-brand" })).toBeNull();
    expect(adminHostIdParamRedirect({ ...base, role: "ADMIN", search: "?hostId=../x" })).toBeNull();
  });
});
