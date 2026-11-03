import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requirePlatformAdmin: vi.fn() }));
const db = vi.hoisted(() => ({
  prisma: { host: { findUnique: vi.fn(), update: vi.fn() } },
}));
// Any Stripe or billing call fails the test.
const stripeSpy = vi.hoisted(() => ({ ctor: vi.fn(), any: vi.fn() }));
vi.mock("@/lib/auth", () => auth);
vi.mock("@/lib/db", () => db);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("stripe", () => ({ default: stripeSpy.ctor }));
vi.mock("@/lib/stripe", () => ({
  getStripe: stripeSpy.any,
  getStripeClient: stripeSpy.any,
  requireStripeClient: stripeSpy.any,
  isStripeConfigured: stripeSpy.any,
}));
vi.mock("@/lib/platform-billing", () => ({
  cancelPlatformHostingSubscription: stripeSpy.any,
  pausePlatformHostingSubscription: stripeSpy.any,
}));

import { setServicesOverride } from "./services-override";

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const BILLING_KEYS = [
  "planId",
  "subscriptionStatus",
  "stripeSubscriptionId",
  "stripeCustomerId",
  "sitePresence",
  "hostingMode",
];

describe("setServicesOverride (Platform admin only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.host.findUnique.mockResolvedValue({
      id: "h_qa",
      slug: "qa-tester-two",
      siteServicesBlocks: "[]",
      siteServicesTitle: null,
      siteServicesPath: null,
    });
    db.prisma.host.update.mockResolvedValue({});
  });

  it("a platform admin turns it on: override + page on, starter blocks, nothing billing", async () => {
    auth.requirePlatformAdmin.mockResolvedValue({ user: { id: "u_admin", role: "ADMIN" } });
    await setServicesOverride(form({ hostId: "h_qa", servicesOverride: "on" }));
    expect(db.prisma.host.update).toHaveBeenCalledTimes(1);
    const { where, data } = db.prisma.host.update.mock.calls[0]![0];
    expect(where).toEqual({ id: "h_qa" });
    expect(data.servicesOverride).toBe(true);
    expect(data.sitePageServices).toBe(true);
    expect(JSON.parse(data.siteServicesBlocks).length).toBeGreaterThan(0);
    for (const k of BILLING_KEYS) expect(data).not.toHaveProperty(k);
    expect(stripeSpy.ctor).not.toHaveBeenCalled();
    expect(stripeSpy.any).not.toHaveBeenCalled();
  });

  it("keeps existing blocks, title and path", async () => {
    auth.requirePlatformAdmin.mockResolvedValue({ user: { id: "u_admin", role: "ADMIN" } });
    db.prisma.host.findUnique.mockResolvedValue({
      id: "h_qa",
      slug: "qa-tester-two",
      siteServicesBlocks: '[{"id":"a","type":"text","content":"x"}]',
      siteServicesTitle: "Tours",
      siteServicesPath: "tours",
    });
    await setServicesOverride(form({ hostId: "h_qa", servicesOverride: "on" }));
    const { data } = db.prisma.host.update.mock.calls[0]![0];
    expect(data).toEqual({ servicesOverride: true, sitePageServices: true });
  });

  it("a platform admin turns it off: only the override changes", async () => {
    auth.requirePlatformAdmin.mockResolvedValue({ user: { id: "u_admin", role: "ADMIN" } });
    await setServicesOverride(form({ hostId: "h_qa" }));
    const { data } = db.prisma.host.update.mock.calls[0]![0];
    expect(data).toEqual({ servicesOverride: false });
    expect(stripeSpy.any).not.toHaveBeenCalled();
  });

  it("a host (not a platform admin) cannot set it", async () => {
    auth.requirePlatformAdmin.mockResolvedValue(null);
    await expect(
      setServicesOverride(form({ hostId: "h_qa", servicesOverride: "on" })),
    ).rejects.toThrow(/platform admin/i);
    expect(db.prisma.host.findUnique).not.toHaveBeenCalled();
    expect(db.prisma.host.update).not.toHaveBeenCalled();
  });

  it("a session without the ADMIN role cannot set it", async () => {
    auth.requirePlatformAdmin.mockResolvedValue({ user: { id: "u_host", role: "HOST" } });
    await expect(
      setServicesOverride(form({ hostId: "h_qa", servicesOverride: "on" })),
    ).rejects.toThrow(/platform admin/i);
    expect(db.prisma.host.update).not.toHaveBeenCalled();
  });

  it("unknown brand: no update", async () => {
    auth.requirePlatformAdmin.mockResolvedValue({ user: { id: "u_admin", role: "ADMIN" } });
    db.prisma.host.findUnique.mockResolvedValue(null);
    await expect(
      setServicesOverride(form({ hostId: "nope", servicesOverride: "on" })),
    ).rejects.toThrow(/not found/i);
    expect(db.prisma.host.update).not.toHaveBeenCalled();
  });
});
