import { beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.hoisted(() => [] as string[]);
const jar = vi.hoisted(() => ({
  set: vi.fn((name: string, value: string) => order.push(`set:${name}=${value}`)),
  delete: vi.fn((name: string) => order.push(`delete:${name}`)),
}));
const db = vi.hoisted(() => ({ host: { findFirst: vi.fn() } }));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => jar) }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((p: string) => order.push(`revalidate:${p}`)),
  refresh: vi.fn(() => order.push("refresh")),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    order.push(`redirect:${to}`);
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(async () => ({ user: { id: "u_hugh" } })),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { setAdminBrandContext, switchAdminBrand } from "./admin-brand";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("switch brand (first click must take effect)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    db.host.findFirst.mockResolvedValue({ id: "host_hugh", slug: "hugh-roberts" });
  });

  it("sets the cookie and refreshes, then returns the path (no redirect)", async () => {
    const r = await switchAdminBrand(
      form({ hostId: "host_hugh", returnTo: "/admin" }),
    );
    expect(r).toEqual({ ok: true, path: "/admin?brand=hugh-roberts", hostId: "host_hugh" });
    expect(order).toContain("set:ycb_admin_brand_slug=hugh-roberts");
    expect(order[0]).toBe("set:ycb_admin_brand=host_hugh");
    expect(order).toContain("refresh");
    expect(order.some((o) => o.startsWith("redirect:"))).toBe(false);
  });

  it("drops a previous brand's detail URL", async () => {
    const r = await switchAdminBrand(
      form({ hostId: "host_hugh", returnTo: "/admin/properties/prop_cherokee" }),
    );
    expect(r.path).toBe("/admin/properties?brand=hugh-roberts");
  });

  it("clears the brand when none is picked", async () => {
    const r = await switchAdminBrand(form({ hostId: "", returnTo: "/admin" }));
    expect(r.hostId).toBeNull();
    expect(jar.delete).toHaveBeenCalledWith("ycb_admin_brand");
    expect(jar.delete).toHaveBeenCalledWith("ycb_admin_brand_slug");
    expect(jar.set).not.toHaveBeenCalled();
    expect(r.path).toBe("/admin?brand=1");
  });

  it("unknown brand: clears the cookie and reports not ok", async () => {
    db.host.findFirst.mockResolvedValue(null);
    const r = await switchAdminBrand(form({ hostId: "nope", returnTo: "/admin" }));
    expect(r.ok).toBe(false);
    expect(jar.delete).toHaveBeenCalled();
  });

  it("form version sets the cookie before it redirects", async () => {
    await expect(
      setAdminBrandContext(form({ hostId: "host_hugh", returnTo: "/admin/brand" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    const setAt = order.indexOf("set:ycb_admin_brand=host_hugh");
    const redirectAt = order.indexOf("redirect:/admin/brand?brand=hugh-roberts");
    expect(setAt).toBeGreaterThanOrEqual(0);
    expect(redirectAt).toBeGreaterThan(setAt);
  });

  it("Change brand: clears both cookies and returns to the picker", async () => {
    const r = await switchAdminBrand(form({ hostId: "", returnTo: "/admin" }));
    expect(r).toEqual({ ok: true, path: "/admin?brand=1", hostId: null });
    expect(jar.delete).toHaveBeenCalledWith("ycb_admin_brand");
    expect(jar.delete).toHaveBeenCalledWith("ycb_admin_brand_slug");
  });
});
