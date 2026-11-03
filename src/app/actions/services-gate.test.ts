import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { host: { findUnique: vi.fn(), update: vi.fn() } },
}));
const auth = vi.hoisted(() => ({
  requireHostAdmin: vi.fn(),
  signIn: vi.fn(),
  auth: vi.fn(),
}));
const guest = vi.hoisted(() => ({ getHostForGuestSite: vi.fn() }));
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

// A leftover Host.servicesOverride = true (deprecated column) must grant nothing.
const leftoverOverride = { ...base, servicesOverride: true };

describe("Services gate (Branded plan only, no override)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guest.getHostForGuestSite.mockReset();
    auth.requireHostAdmin.mockResolvedValue({ isPlatform: false, hostId: "h_qa" });
  });

  it("marketplace-only host cannot save the Services editor, even with the old override flag", async () => {
    for (const host of [base, leftoverOverride]) {
      db.prisma.host.findUnique.mockResolvedValue(host);
      await expect(
        saveServicesBlocks(form({ hostId: "h_qa", blocksJson: "[]" })),
      ).rejects.toThrow(/Branded website plan/);
      const r = await uploadServicesImage(form({ hostId: "h_qa" }));
      expect(r).toEqual({ ok: false, error: "The Services page needs the Branded website plan." });
    }
    expect(db.prisma.host.update).not.toHaveBeenCalled();
  });

  it("public route: 404 for marketplace-only, even with the old override flag", async () => {
    for (const host of [base, leftoverOverride]) {
      guest.getHostForGuestSite.mockResolvedValue(host);
      await expect(
        HostServicesPage({ params: Promise.resolve({ hostSlug: "qa" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("a marketplace brand that moves to Branded gets Services", async () => {
    const migrated = { ...base, sitePresence: "BOTH" };
    db.prisma.host.findUnique.mockResolvedValue(migrated);
    await saveServicesBlocks(form({ hostId: "h_qa", blocksJson: "[]" }));
    expect(db.prisma.host.update).toHaveBeenCalledTimes(1);
    guest.getHostForGuestSite.mockResolvedValue(migrated);
    await expect(
      HostServicesPage({ params: Promise.resolve({ hostSlug: "qa" }) }),
    ).resolves.toBeTruthy();
  });
});
