import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: {
    property: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => db);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
// Any host (not only platform admin) can save listing pricing.
vi.mock("@/lib/scope", () => ({
  ensureHostAccess: vi.fn(async () => ({ hostId: "h1", isPlatform: false })),
  assertPropertyAccess: vi.fn(async () => ({ id: "p1" })),
  resolveHostIdForCreate: vi.fn(),
}));
vi.mock("@/lib/hosting", () => ({ assertHostAllowsFutureWork: vi.fn() }));
vi.mock("@/lib/email-verified", () => ({
  assertEmailVerifiedForPublish: vi.fn(),
}));
vi.mock("@/lib/upload-image", () => ({
  PROPERTY_IMAGE_MAX_BYTES: 1,
  readUploadedImage: vi.fn(),
  writePublicUpload: vi.fn(),
}));
vi.mock("@/lib/safe-url", () => ({ assertSafeOutboundUrl: vi.fn() }));

import { updatePropertyPricing } from "./properties";
import { extraGuestSettingsError } from "@/lib/extra-guests";

function pricingForm(extra: Record<string, string>) {
  const f = new FormData();
  f.set("propertyId", "p1");
  f.set("baseNightlyRate", "75");
  f.set("weekendPremiumPercent", "0");
  f.set("cleaningFee", "35");
  f.set("petFee", "25");
  f.set("petFeeUnit", "PER_STAY");
  f.set("maxPets", "2");
  f.set("defaultMinNights", "1");
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

describe("listing pricing: extra-guest fee and guests included", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.prisma.property.findUnique.mockResolvedValue({ maxGuests: 4 });
    db.prisma.property.update.mockResolvedValue({
      id: "p1",
      slug: "motel-room-2",
      host: { slug: "cherokee-landing" },
    });
  });

  it("saves $10 per extra guest with 2 included (motel-room-2)", async () => {
    await updatePropertyPricing(
      pricingForm({ extraGuestFee: "10", extraGuestsIncluded: "2" }),
    );
    expect(db.prisma.property.update.mock.calls[0]![0].data).toMatchObject({
      extraGuestFee: 10,
      extraGuestsIncluded: 2,
    });
  });

  it("rejects a negative fee", async () => {
    await expect(
      updatePropertyPricing(pricingForm({ extraGuestFee: "-1" })),
    ).rejects.toThrow(/0 or more/);
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("rejects included guests above the listing max (4) or below 1", async () => {
    for (const v of ["5", "0", "1.5"]) {
      await expect(
        updatePropertyPricing(pricingForm({ extraGuestsIncluded: v })),
      ).rejects.toThrow(/from 1 to 4/);
    }
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("accepts included = max guests", async () => {
    await updatePropertyPricing(pricingForm({ extraGuestsIncluded: "4" }));
    expect(db.prisma.property.update).toHaveBeenCalledTimes(1);
  });

  it("forms that do not send the fields leave them alone", async () => {
    await updatePropertyPricing(pricingForm({}));
    const data = db.prisma.property.update.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("extraGuestFee");
    expect(data).not.toHaveProperty("extraGuestsIncluded");
  });
});

describe("extraGuestSettingsError", () => {
  it("allows fee >= 0 and included 1..max", () => {
    expect(extraGuestSettingsError({ extraGuestFee: 0, extraGuestsIncluded: 1, maxGuests: 4 })).toBeNull();
    expect(extraGuestSettingsError({ extraGuestFee: 10, extraGuestsIncluded: 4, maxGuests: 4 })).toBeNull();
    expect(extraGuestSettingsError({ extraGuestFee: null, extraGuestsIncluded: null, maxGuests: 4 })).toBeNull();
  });
  it("rejects NaN fee", () => {
    expect(extraGuestSettingsError({ extraGuestFee: NaN, extraGuestsIncluded: null, maxGuests: 4 })).toMatch(/0 or more/);
  });
});
