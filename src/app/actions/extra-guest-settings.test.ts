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
import {
  extraGuestFieldErrors,
  extraGuestSettingsError,
  pricingSaveBlocked,
} from "@/lib/extra-guests";

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
    const r = await updatePropertyPricing(pricingForm({ extraGuestFee: "-1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.extraGuestFee).toMatch(/0 or more/);
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("rejects every negative fee on the server (UI bypassed)", async () => {
    for (const v of ["-0.01", "-10", "-1000", " -5 "]) {
      const r = await updatePropertyPricing(
        pricingForm({ extraGuestFee: v, extraGuestsIncluded: "2" }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.extraGuestFee).toMatch(/0 or more/);
    }
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("Save pricing is disabled while either field is invalid", () => {
    const errs = (fee: string, included: string) =>
      extraGuestFieldErrors({
        extraGuestFee: fee,
        extraGuestsIncluded: included,
        maxGuests: 4,
      });
    expect(pricingSaveBlocked(errs("-1", "2"))).toBe(true);
    expect(pricingSaveBlocked(errs("abc", "2"))).toBe(true);
    expect(pricingSaveBlocked(errs("10", "0"))).toBe(true);
    expect(pricingSaveBlocked(errs("10", "5"))).toBe(true);
    expect(pricingSaveBlocked(errs("10", "2"))).toBe(false);
    expect(pricingSaveBlocked(errs("10", "2"), { extraGuestFee: "server" })).toBe(true);
  });

  it("the pricing form disables and blocks Save on errors", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync("src/components/admin-listing-workspace.tsx", "utf8");
    expect(src).toMatch(/disabled=\{pending \|\| saveBlocked\}/);
    expect(src).toMatch(/if \(pricingSaveBlocked\(extraErrors\)\) \{/);
  });

  it("rejects a non-numeric fee (never saved as 0)", async () => {
    for (const v of ["abc", "1e2", "0x10", "10$", "NaN", "Infinity"]) {
      const r = await updatePropertyPricing(pricingForm({ extraGuestFee: v }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.extraGuestFee).toMatch(/must be a number/);
    }
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("rejects included guests above the listing max (4) or below 1", async () => {
    for (const v of ["5", "0", "1.5"]) {
      const r = await updatePropertyPricing(
        pricingForm({ extraGuestsIncluded: v }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.extraGuestsIncluded).toMatch(/from 1 to 4/);
    }
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("rejects negative, non-numeric or empty included guests", async () => {
    const cases: [string, RegExp][] = [
      ["-2", /1 or more/],
      ["two", /must be a number/],
      ["2e0", /must be a number/],
      ["", /Enter how many guests/],
    ];
    for (const [v, re] of cases) {
      const r = await updatePropertyPricing(
        pricingForm({ extraGuestsIncluded: v }),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.extraGuestsIncluded).toMatch(re);
    }
    expect(db.prisma.property.update).not.toHaveBeenCalled();
  });

  it("an empty fee means $0", async () => {
    const r = await updatePropertyPricing(
      pricingForm({ extraGuestFee: "", extraGuestsIncluded: "2" }),
    );
    expect(r).toEqual({ ok: true });
    expect(db.prisma.property.update.mock.calls[0]![0].data).toMatchObject({
      extraGuestFee: 0,
    });
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
  it("extraGuestFieldErrors flags the browser's badInput (text a number input cannot read)", () => {
    expect(
      extraGuestFieldErrors({
        extraGuestFee: "",
        extraGuestsIncluded: "",
        maxGuests: 4,
        feeBadInput: true,
        includedBadInput: true,
      }),
    ).toEqual({
      extraGuestFee: expect.stringMatching(/must be a number/),
      extraGuestsIncluded: expect.stringMatching(/must be a number/),
    });
    expect(
      extraGuestFieldErrors({ extraGuestFee: " 12.50 ", extraGuestsIncluded: " 3 ", maxGuests: 4 }),
    ).toEqual({});
    expect(
      extraGuestFieldErrors({ extraGuestFee: null, extraGuestsIncluded: null, maxGuests: 4 }),
    ).toEqual({});
  });
  it("rejects NaN fee", () => {
    expect(extraGuestSettingsError({ extraGuestFee: NaN, extraGuestsIncluded: null, maxGuests: 4 })).toMatch(/0 or more/);
  });
});
