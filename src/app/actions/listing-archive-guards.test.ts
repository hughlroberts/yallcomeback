import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    property: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/scope", () => ({
  ensureHostAccess: vi.fn(async () => ({
    hostId: "h1",
    isPlatform: false,
    session: { user: { id: "u1" } },
  })),
  assertPropertyAccess: vi.fn(async () => ({ id: "p1" })),
  resolveHostIdForCreate: vi.fn(),
}));
vi.mock("@/lib/hosting", () => ({
  assertHostAllowsFutureWork: vi.fn(),
  HOSTING_PUBLIC_STATUSES: ["ACTIVE"],
}));
vi.mock("@/lib/email-verified", () => ({ assertEmailVerifiedForPublish: vi.fn() }));
vi.mock("@/lib/upload-image", () => ({
  PROPERTY_IMAGE_MAX_BYTES: 1,
  readUploadedImage: vi.fn(),
  writePublicUpload: vi.fn(),
}));
vi.mock("@/lib/safe-url", () => ({ assertSafeOutboundUrl: vi.fn() }));

import { publishListing, updateListingVisibility } from "./properties";
import { marketplacePropertyWhere } from "@/lib/host";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const archived = {
  id: "p1",
  title: "Cabin",
  city: "Austin",
  address: null,
  baseNightlyRate: 100,
  published: false,
  archivedAt: new Date("2026-11-01T00:00:00Z"),
  host: { id: "h1", slug: "brand" },
};

function form(visibility: string) {
  const f = new FormData();
  f.set("id", "p1");
  f.set("visibility", visibility);
  return f;
}

describe("archived listings cannot be published", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.property.findUnique.mockResolvedValue(archived);
    db.prisma.property.findUniqueOrThrow.mockResolvedValue(archived);
  });

  it("Taking bookings → On is rejected", async () => {
    await expect(updateListingVisibility(form("both"))).rejects.toThrow(/Restore/);
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("Taking bookings → Off still works", async () => {
    await updateListingVisibility(form("off"));
    expect(db.prisma.property.update).toHaveBeenCalled();
  });

  it("setup wizard publish is rejected", async () => {
    await expect(publishListing(form("website"))).rejects.toThrow(/Restore/);
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });
});

describe("booking paths exclude archived listings", () => {
  it("marketplace where (search, agent checkout, availability) requires archivedAt null", () => {
    expect(marketplacePropertyWhere()).toMatchObject({
      published: true,
      archivedAt: null,
    });
  });

  it("createBooking, agent checkout and inquiries check archivedAt", () => {
    const root = process.cwd();
    const read = (p: string) => readFileSync(join(root, p), "utf8");
    expect(read("src/app/actions/bookings.ts")).toMatch(
      /!property\.published \|\| property\.archivedAt/,
    );
    expect(read("src/lib/agent/checkout.ts")).toMatch(/property\.archivedAt/);
    expect(read("src/lib/inquiries/submit.ts")).toMatch(
      /published: true, archivedAt: null/,
    );
  });
});
