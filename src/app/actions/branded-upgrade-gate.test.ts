import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    host: { findUnique: vi.fn(), update: vi.fn() },
    hostingPlan: { findUnique: vi.fn(), findFirst: vi.fn() },
    property: { updateMany: vi.fn() },
  },
}));
const auth = vi.hoisted(() => ({
  requireHostAdmin: vi.fn(),
  signIn: vi.fn(),
  auth: vi.fn(),
}));
const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  notFound: vi.fn(),
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => nav);
vi.mock("@/lib/account-email", () => ({ sendSignupVerificationEmail: vi.fn() }));
vi.mock("@/lib/upload-image", () => ({ readUploadedImage: vi.fn(), writePublicUpload: vi.fn() }));

import { updateHostProfile, upgradeToBrandedWebsite } from "./host";

const market = {
  id: "h1",
  slug: "qa",
  name: "QA",
  hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL",
  listOnMarketplace: true,
  sitePublishState: "DEMO",
  planId: "plan_market",
  customDomain: null,
  primaryColor: "#2563eb",
  sitePageAbout: false,
  sitePageServices: false,
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("Marketplace → Branded never switches instantly (T38)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.requireHostAdmin.mockResolvedValue({ isPlatform: false, hostId: "h1" });
    db.prisma.host.findUnique.mockResolvedValue(market);
    db.prisma.host.update.mockImplementation(async ({ data }) => ({ ...market, ...data }));
    db.prisma.hostingPlan.findFirst.mockResolvedValue(null);
  });

  it("old upgrade button goes to the confirm page and changes nothing", async () => {
    await expect(upgradeToBrandedWebsite(form({ hostId: "h1" }))).rejects.toThrow(
      "NEXT_REDIRECT:/account/settings/subscription/upgrade?hostId=h1&returnTo=%2Fadmin%2Fbrand",
    );
    expect(db.prisma.host.update).not.toHaveBeenCalled();
  });

  it("saving Brand with Branded picked keeps a paid brand on Marketplace and opens confirm", async () => {
    db.prisma.hostingPlan.findUnique.mockResolvedValue({ monthlyPrice: 12, slug: "marketplace" });
    await expect(
      updateHostProfile(form({ hostId: "h1", name: "QA", sitePresence: "BOTH", returnTo: "/admin/brand" })),
    ).rejects.toThrow(/NEXT_REDIRECT:\/account\/settings\/subscription\/upgrade\?hostId=h1/);
    const data = db.prisma.host.update.mock.calls[0][0].data;
    expect(data.sitePresence).toBe("STAYLOCAL");
    expect(data.planId).toBeUndefined();
  });

  it("saving Brand on Marketplace still saves normally", async () => {
    db.prisma.hostingPlan.findUnique.mockResolvedValue({ monthlyPrice: 12, slug: "marketplace" });
    await expect(
      updateHostProfile(form({ hostId: "h1", name: "QA", sitePresence: "STAYLOCAL", returnTo: "/admin/brand" })),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/brand?saved=1");
  });
});
