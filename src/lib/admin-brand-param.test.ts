import { describe, expect, it } from "vitest";
import {
  adminBrandParamRedirect,
  adminLegacyBrandParamRewrite,
  brandSlugFromParam,
  safeAdminReturnTo,
  withoutBrandParam,
} from "@/lib/admin-brand-path";

describe("?brand=<slug> admin URLs", () => {
  it("old ?brand=1 is not a slug (left as is)", () => {
    expect(brandSlugFromParam("1")).toBeNull();
    expect(brandSlugFromParam("")).toBeNull();
    expect(brandSlugFromParam("Cherokee-Landing")).toBe("cherokee-landing");
    expect(brandSlugFromParam("../x")).toBeNull();
  });

  it("platform admin on another brand → switch route, then same URL", () => {
    const to = adminBrandParamRedirect({
      pathname: "/admin/messages",
      search: "?brand=cherokee-landing&x=1",
      role: "ADMIN",
      slugCookie: "hugh-roberts",
    });
    const u = new URL(to!, "http://x");
    expect(u.pathname).toBe("/admin/use-brand");
    expect(u.searchParams.get("slug")).toBe("cherokee-landing");
    expect(u.searchParams.get("to")).toBe("/admin/messages?brand=cherokee-landing&x=1");
  });

  it("no redirect: same brand, ?brand=1, not admin, outside /admin, or the switch route", () => {
    const base = { pathname: "/admin/messages", role: "ADMIN", slugCookie: "hugh-roberts" };
    expect(adminBrandParamRedirect({ ...base, search: "?brand=hugh-roberts" })).toBeNull();
    expect(adminBrandParamRedirect({ ...base, search: "?brand=1" })).toBeNull();
    expect(adminBrandParamRedirect({ ...base, search: "" })).toBeNull();
    expect(
      adminBrandParamRedirect({ ...base, role: "HOST", search: "?brand=cherokee-landing" }),
    ).toBeNull();
    expect(
      adminBrandParamRedirect({ ...base, pathname: "/stays", search: "?brand=cherokee-landing" }),
    ).toBeNull();
    expect(
      adminBrandParamRedirect({
        ...base,
        pathname: "/admin/use-brand",
        search: "?brand=cherokee-landing",
      }),
    ).toBeNull();
  });

  it("return path stays on /admin", () => {
    expect(safeAdminReturnTo("/admin/messages?brand=a")).toBe("/admin/messages?brand=a");
    expect(safeAdminReturnTo("https://evil.example")).toBe("/admin");
    expect(safeAdminReturnTo("//evil.example/admin")).toBe("/admin");
    expect(safeAdminReturnTo("/stays")).toBe("/admin");
    expect(withoutBrandParam("/admin/messages?brand=nope&x=1")).toBe("/admin/messages?x=1");
    expect(withoutBrandParam("/admin/messages?brand=nope")).toBe("/admin/messages");
  });

  it("old ?brand=1 → picked brand's slug, or dropped when none is picked", () => {
    const base = { pathname: "/admin", role: "ADMIN", slugCookie: "cherokee-landing" };
    expect(adminLegacyBrandParamRewrite({ ...base, search: "?brand=1" })).toBe(
      "/admin?brand=cherokee-landing",
    );
    expect(
      adminLegacyBrandParamRewrite({
        ...base,
        pathname: "/admin/messages",
        search: "?x=2&brand=1",
      }),
    ).toBe("/admin/messages?x=2&brand=cherokee-landing");
    expect(
      adminLegacyBrandParamRewrite({ ...base, slugCookie: null, search: "?brand=1" }),
    ).toBe("/admin");
    expect(
      adminLegacyBrandParamRewrite({ ...base, slugCookie: "../bad", search: "?brand=1&x=1" }),
    ).toBe("/admin?x=1");
  });

  it("?brand=1 rewrite: never for slugs, hosts, other areas or the switch route", () => {
    const base = { pathname: "/admin", role: "ADMIN", slugCookie: "cherokee-landing" };
    expect(adminLegacyBrandParamRewrite({ ...base, search: "?brand=hugh-roberts" })).toBeNull();
    expect(adminLegacyBrandParamRewrite({ ...base, search: "" })).toBeNull();
    expect(adminLegacyBrandParamRewrite({ ...base, role: "HOST", search: "?brand=1" })).toBeNull();
    expect(
      adminLegacyBrandParamRewrite({ ...base, pathname: "/stays", search: "?brand=1" }),
    ).toBeNull();
    expect(
      adminLegacyBrandParamRewrite({ ...base, pathname: "/admin/use-brand", search: "?brand=1" }),
    ).toBeNull();
    // After the rewrite, the slug matches the cookie: no switch, no loop.
    const next = adminLegacyBrandParamRewrite({ ...base, search: "?brand=1" })!;
    expect(
      adminBrandParamRedirect({ ...base, search: next.slice(next.indexOf("?")) }),
    ).toBeNull();
  });
});
