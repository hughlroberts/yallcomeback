import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { host: { findUnique: vi.fn(), update: vi.fn() } },
}));
const auth = vi.hoisted(() => ({
  requireHostAdmin: vi.fn(),
  signIn: vi.fn(),
  auth: vi.fn(),
}));
const guest = vi.hoisted(() => {
  const getHostForGuestSite = vi.fn();
  return {
    getHostForGuestSite,
    // Route helper: wraps the guest-site host (servicesOnly false here).
    getHostForGuestServicesPage: vi.fn(async (slug: string) => {
      const host = await getHostForGuestSite(slug);
      return host ? { host, servicesOnly: false } : null;
    }),
  };
});
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/auth", () => auth);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/account-email", () => ({ sendSignupVerificationEmail: vi.fn() }));
vi.mock("@/lib/upload-image", () => ({
  readUploadedImage: vi.fn(),
  writePublicUpload: vi.fn(),
}));
vi.mock("@/lib/host", () => guest);
vi.mock("@/lib/host-base-path", () => ({ hostPublicBasePath: vi.fn(async () => "/h/qa") }));
vi.mock("@/components/host-services-page", () => ({
  HostServicesPageView: () => "services-view",
}));

import { saveServicesBlocks, uploadServicesImage } from "./host";
import HostServicesPage from "@/app/h/[hostSlug]/services/page";

const base = {
  id: "h_qa",
  slug: "qa",
  hostingMode: "PLATFORM",
  sitePresence: "STAYLOCAL",
  servicesOverride: false,
  sitePageServices: true,
  siteServicesPath: null,
};

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("Services gate (paid plan or Platform admin override)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guest.getHostForGuestSite.mockReset();
    auth.requireHostAdmin.mockResolvedValue({ isPlatform: false, hostId: "h_qa" });
  });

  it("marketplace-only host without override cannot save the Services editor", async () => {
    db.prisma.host.findUnique.mockResolvedValue(base);
    await expect(
      saveServicesBlocks(form({ hostId: "h_qa", blocksJson: "[]" })),
    ).rejects.toThrow(/Branded website plan/);
    expect(db.prisma.host.update).not.toHaveBeenCalled();
    const r = await uploadServicesImage(form({ hostId: "h_qa" }));
    expect(r).toEqual({ ok: false, error: "The Services page needs the Branded website plan." });
  });

  it("with the override, the host can save the Services editor", async () => {
    db.prisma.host.findUnique.mockResolvedValue({ ...base, servicesOverride: true });
    await saveServicesBlocks(form({ hostId: "h_qa", blocksJson: "[]" }));
    expect(db.prisma.host.update).toHaveBeenCalledTimes(1);
  });

  it("public route: 404 without the override, loads with it", async () => {
    const params = Promise.resolve({ hostSlug: "qa" });
    guest.getHostForGuestSite.mockResolvedValue(base);
    await expect(HostServicesPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    guest.getHostForGuestSite.mockResolvedValue({ ...base, servicesOverride: true });
    await expect(
      HostServicesPage({ params: Promise.resolve({ hostSlug: "qa" }) }),
    ).resolves.toBeTruthy();
  });

  it("branded hosts keep Services without the override", async () => {
    guest.getHostForGuestSite.mockResolvedValue({ ...base, sitePresence: "BOTH" });
    await expect(
      HostServicesPage({ params: Promise.resolve({ hostSlug: "qa" }) }),
    ).resolves.toBeTruthy();
  });
});
