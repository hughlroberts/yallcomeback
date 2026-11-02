import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  host: { findUnique: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => null) },
}));
const admin = vi.hoisted(() => vi.fn<() => Promise<unknown>>(async () => ({ user: { id: "u" } })));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: admin }));

import { GET } from "./route";

const call = (slug: string, to: string) =>
  GET(
    new Request(
      `http://localhost/admin/use-brand?${new URLSearchParams({ slug, to })}`,
    ),
  );

describe("/admin/use-brand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.host.findUnique.mockResolvedValue(null);
  });

  it("sets both brand cookies and returns to the bookmarked URL", async () => {
    db.host.findUnique.mockResolvedValue({ id: "host_cherokee", slug: "cherokee-landing" });
    const res = await call("cherokee-landing", "/admin/messages?brand=cherokee-landing");
    expect(res.headers.get("location")).toBe(
      "http://localhost/admin/messages?brand=cherokee-landing",
    );
    const set = res.headers.getSetCookie().join("\n");
    expect(set).toContain("ycb_admin_brand=host_cherokee");
    expect(set).toContain("ycb_admin_brand_slug=cherokee-landing");
  });

  it("unknown brand: drops ?brand= (no loop) and sets nothing", async () => {
    const res = await call("nope", "/admin/messages?brand=nope");
    expect(res.headers.get("location")).toBe("http://localhost/admin/messages");
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("not a platform admin: no switch", async () => {
    admin.mockResolvedValueOnce(null);
    const res = await call("cherokee-landing", "/admin/messages?brand=cherokee-landing");
    expect(res.headers.get("location")).toBe("http://localhost/admin/messages");
    expect(db.host.findUnique).not.toHaveBeenCalled();
  });

  it("never leaves /admin", async () => {
    const res = await call("x", "https://evil.example/");
    expect(res.headers.get("location")).toBe("http://localhost/admin");
  });
});
