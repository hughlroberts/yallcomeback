"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseTimeTo24h, slugify } from "@/lib/utils";
import {
  assertPropertyAccess,
  ensureHostAccess,
  resolveHostIdForCreate,
} from "@/lib/scope";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function createProperty(formData: FormData) {
  const access = await ensureHostAccess();
  const hostId = await resolveHostIdForCreate(access, formData);
  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title required");

  let slug = slugify(title);
  const existing = await prisma.property.findFirst({
    where: { hostId, slug },
  });
  if (existing) slug = `${slug}-${Date.now().toString(36)}`;

  const host = await prisma.host.findUniqueOrThrow({ where: { id: hostId } });
  const propertyType = String(formData.get("propertyType") || "house");

  const baseNightlyRate = Number(formData.get("baseNightlyRate") || 150);
  const defaultMinNights = Math.max(
    1,
    Math.min(30, Number(formData.get("defaultMinNights") || 1)),
  );

  const property = await prisma.property.create({
    data: {
      hostId,
      title,
      slug,
      propertyType,
      baseNightlyRate,
      defaultMinNights,
      maxGuests: Number(formData.get("maxGuests") || 4),
      bedrooms: Number(formData.get("bedrooms") || 1),
      bathrooms: Number(formData.get("bathrooms") || 1),
      city: String(formData.get("city") || "") || null,
      published: false,
      listOnMarketplace: host.listOnMarketplace,
    },
  });

  await prisma.icalConnection.create({
    data: {
      propertyId: property.id,
      name: "Export feed",
      enabled: true,
    },
  });

  await seedPeakHolidaysForProperty(property.id, baseNightlyRate, 2);

  revalidatePath("/admin/properties");
  redirect(`/admin/properties/${property.id}`);
}

/**
 * Clone a listing for quick variants (same place, different photos/amenities/etc.).
 * Copies details, amenities, rooms, rates, seasons, and photos.
 * Does not copy bookings, calendar blocks, or iCal imports. Always starts as draft.
 */
export async function duplicateProperty(formData: FormData) {
  const access = await ensureHostAccess();
  const { canCreateListings, resolveHostAccessInfo } = await import(
    "@/lib/host-access"
  );
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canCreateListings(info)) {
    throw new Error("Your access level cannot create or duplicate listings");
  }
  const id = String(formData.get("propertyId") || formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const source = await prisma.property.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      seasons: true,
    },
  });
  if (!source) throw new Error("Property not found");

  const baseTitle = source.title
    .replace(/\s*\(copy(?:\s+\d+)?\)\s*$/i, "")
    .trim() || "Listing";

  let title = `${baseTitle} (copy)`;
  let slug = slugify(title);
  let attempt = 2;
  // Keep host+slug unique
  while (
    await prisma.property.findFirst({
      where: { hostId: source.hostId, slug },
      select: { id: true },
    })
  ) {
    title = `${baseTitle} (copy ${attempt})`;
    slug = slugify(title);
    attempt += 1;
    if (attempt > 40) {
      slug = `${slugify(baseTitle)}-copy-${Date.now().toString(36)}`;
      title = `${baseTitle} (copy)`;
      break;
    }
  }

  const copy = await prisma.property.create({
    data: {
      hostId: source.hostId,
      locationId: source.locationId,
      title,
      slug,
      propertyType: source.propertyType,
      spaceType: source.spaceType,
      tagline: source.tagline,
      description: source.description,
      address: source.address,
      city: source.city,
      region: source.region,
      country: source.country,
      postalCode: source.postalCode,
      latitude: source.latitude,
      longitude: source.longitude,
      showPreciseLocation: source.showPreciseLocation,
      bedrooms: source.bedrooms,
      bathrooms: source.bathrooms,
      maxGuests: source.maxGuests,
      beds: source.beds,
      sleepingArrangements: source.sleepingArrangements,
      baseNightlyRate: source.baseNightlyRate,
      weekendPremiumPercent: source.weekendPremiumPercent,
      discountNewListingPercent: source.discountNewListingPercent,
      discountLastMinutePercent: source.discountLastMinutePercent,
      discountWeeklyPercent: source.discountWeeklyPercent,
      discountMonthlyPercent: source.discountMonthlyPercent,
      defaultMinNights: source.defaultMinNights,
      cleaningFee: source.cleaningFee,
      petFee: source.petFee,
      petFeeUnit: source.petFeeUnit,
      petsAllowed: source.petsAllowed,
      maxPets: source.maxPets,
      depositPercent: source.depositPercent,
      checkInTime: source.checkInTime,
      checkOutTime: source.checkOutTime,
      houseRules: source.houseRules,
      disclaimer: source.disclaimer,
      amenities: source.amenities,
      cancellationPolicy: source.cancellationPolicy,
      longTermCancellationPolicy: source.longTermCancellationPolicy,
      nonRefundableOption: source.nonRefundableOption,
      autoMsgOnBookingEnabled: source.autoMsgOnBookingEnabled,
      autoMsgOnBookingBody: source.autoMsgOnBookingBody,
      autoMsgWeekBeforeEnabled: source.autoMsgWeekBeforeEnabled,
      autoMsgWeekBeforeBody: source.autoMsgWeekBeforeBody,
      autoMsgDayBeforeEnabled: source.autoMsgDayBeforeEnabled,
      autoMsgDayBeforeBody: source.autoMsgDayBeforeBody,
      // Always draft so you can tweak photos/amenities before going live
      published: false,
      featured: false,
      listOnMarketplace: source.listOnMarketplace,
      images: {
        create: source.images.map((img) => ({
          url: img.url,
          alt: img.alt,
          sortOrder: img.sortOrder,
          isCover: img.isCover,
        })),
      },
      seasons: {
        create: source.seasons.map((s) => ({
          name: s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          nightlyRate: s.nightlyRate,
          minNights: s.minNights,
          holidayKey: s.holidayKey,
        })),
      },
      icalConnections: {
        create: {
          name: "Export feed",
          enabled: true,
        },
      },
    },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${copy.id}`);
  redirect(`/admin/properties/${copy.id}`);
}

/**
 * Wizard step 1 → create unpublished draft with place type only.
 * Later steps fill in photos, pricing, etc.
 */
export async function startListingDraft(formData: FormData) {
  const access = await ensureHostAccess();
  const hostId = await resolveHostIdForCreate(access, formData);
  const { isListingTypeId } = await import("@/lib/listing-types");

  const rawType = String(formData.get("propertyType") || "");
  if (!isListingTypeId(rawType)) {
    throw new Error("Pick a place type");
  }

  const host = await prisma.host.findUniqueOrThrow({ where: { id: hostId } });
  const title = "Untitled listing";
  let slug = `untitled-${Date.now().toString(36)}`;
  const existing = await prisma.property.findFirst({
    where: { hostId, slug },
  });
  if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const property = await prisma.property.create({
    data: {
      hostId,
      title,
      slug,
      propertyType: rawType,
      baseNightlyRate: 150,
      // Configurable per listing - not forced to 2
      defaultMinNights: 1,
      maxGuests: 2,
      bedrooms: 1,
      bathrooms: 1,
      published: false,
      listOnMarketplace: host.listOnMarketplace,
    },
  });

  await prisma.icalConnection.create({
    data: {
      propertyId: property.id,
      name: "Export feed",
      enabled: true,
    },
  });

  // Peak holidays pre-applied at 2-night min (host can upgrade to 3+ later)
  await seedPeakHolidaysForProperty(property.id, property.baseNightlyRate);

  revalidatePath("/admin/properties");
  redirect(`/admin/properties/${property.id}/setup?step=2`);
}

async function seedPeakHolidaysForProperty(
  propertyId: string,
  baseNightlyRate: number,
  minNights = 2,
) {
  const { upcomingPeakHolidays, peakSeasonName } = await import(
    "@/lib/peak-holidays"
  );
  const holidays = upcomingPeakHolidays();
  if (holidays.length === 0) return;

  await prisma.seasonalPrice.createMany({
    data: holidays.map((h) => ({
      propertyId,
      name: peakSeasonName(h),
      holidayKey: h.key,
      startDate: new Date(h.startDate + "T00:00:00"),
      endDate: new Date(h.endDate + "T00:00:00"),
      nightlyRate: baseNightlyRate,
      minNights,
    })),
  });
}

/**
 * Wizard step 2 → entire place / room / shared room.
 */
export async function saveListingSpaceType(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const { isSpaceTypeId } = await import("@/lib/listing-types");
  const raw = String(formData.get("spaceType") || "");
  if (!isSpaceTypeId(raw)) {
    throw new Error("Pick what guests will have");
  }

  await prisma.property.update({
    where: { id },
    data: { spaceType: raw },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=3`);
}

/**
 * Free address lookup via OpenStreetMap Nominatim (no API key).
 */
export async function geocodeListingAddress(query: string): Promise<{
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  displayName?: string;
} | null> {
  await ensureHostAccess();
  const q = query.trim();
  if (!q) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Yall Come Back/0.1 (listing-setup; local-dev)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Address lookup failed - try again");

  const data = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      hamlet?: string;
      state?: string;
      country?: string;
      postcode?: string;
    };
  }>;

  const hit = data[0];
  if (!hit) return null;

  const a = hit.address || {};
  return {
    lat: Number(hit.lat),
    lng: Number(hit.lon),
    city: a.city || a.town || a.village || a.hamlet,
    region: a.state,
    country: a.country,
    postalCode: a.postcode,
    displayName: hit.display_name,
  };
}

/**
 * Wizard step 3 → address, map pin, guest map privacy.
 */
export async function saveListingLocation(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const address = String(formData.get("address") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));

  if (!address && !city) {
    throw new Error("Add a street address or city");
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Map pin is required");
  }

  await prisma.property.update({
    where: { id },
    data: {
      address: address || null,
      city: city || null,
      region: String(formData.get("region") || "").trim() || null,
      country: String(formData.get("country") || "").trim() || null,
      postalCode: String(formData.get("postalCode") || "").trim() || null,
      latitude: lat,
      longitude: lng,
      showPreciseLocation: formData.get("showPreciseLocation") === "on",
    },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=4`);
}

/**
 * Wizard step 4 → guests, bedrooms, beds, bathrooms.
 */
export async function saveListingBasics(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const maxGuests = Math.max(1, Math.min(30, Number(formData.get("maxGuests") || 1)));
  const bedrooms = Math.max(0, Math.min(20, Number(formData.get("bedrooms") || 0)));
  const beds = Math.max(1, Math.min(30, Number(formData.get("beds") || 1)));
  const bathrooms = Math.max(0, Math.min(20, Number(formData.get("bathrooms") || 0)));

  if (![maxGuests, bedrooms, beds, bathrooms].every(Number.isFinite)) {
    throw new Error("Check guest and room numbers");
  }

  await prisma.property.update({
    where: { id },
    data: { maxGuests, bedrooms, beds, bathrooms },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=5`);
}

async function applyAmenityIds(propertyId: string, amenityIdsRaw: string) {
  const { ALL_AMENITY_OPTIONS } = await import("@/lib/listing-amenities");
  const ids = amenityIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set(ALL_AMENITY_OPTIONS.map((a) => a.id));
  const labels = ids
    .filter((aid) => allowed.has(aid))
    .map((aid) => ALL_AMENITY_OPTIONS.find((a) => a.id === aid)!.label);

  return prisma.property.update({
    where: { id: propertyId },
    data: { amenities: JSON.stringify(labels) },
    include: { host: true },
  });
}

/**
 * Wizard step 5 → amenity chips (stored as labels in JSON).
 */
export async function saveListingAmenities(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  await applyAmenityIds(id, String(formData.get("amenityIds") || ""));

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=6`);
}

/** Admin amenities picker - no redirect. */
export async function updatePropertyAmenities(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("propertyId") || formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const property = await applyAmenityIds(
    id,
    String(formData.get("amenityIds") || ""),
  );

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath("/marketplace");
  revalidatePath(`/h/${property.host.slug}`);
  revalidatePath(`/h/${property.host.slug}/properties/${property.slug}`);
}

/** Admin sleeping layout editor - updates beds/bedrooms counts too. */
export async function updateSleepingArrangements(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("propertyId") || formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const {
    parseSleepingArrangements,
    serializeSleepingArrangements,
    bedroomCount,
    totalBedCount,
  } = await import("@/lib/sleeping-arrangements");

  const raw = String(formData.get("sleepingArrangements") || "[]");
  const rooms = parseSleepingArrangements(raw);
  if (rooms.length === 0) {
    throw new Error("Add at least one room with beds");
  }
  const hasAnyBed = rooms.some((r) => r.beds.some((b) => b.count > 0));
  if (!hasAnyBed) {
    throw new Error("Each room needs at least one bed type with a count");
  }

  const bedrooms = Math.max(1, bedroomCount(rooms));
  const beds = Math.max(1, totalBedCount(rooms));

  const property = await prisma.property.update({
    where: { id },
    data: {
      sleepingArrangements: serializeSleepingArrangements(rooms),
      bedrooms,
      beds,
    },
    include: { host: true },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath("/marketplace");
  revalidatePath(`/h/${property.host.slug}`);
  revalidatePath(`/h/${property.host.slug}/properties/${property.slug}`);
}

/**
 * Wizard step 6 → short listing title (+ slug when still a draft).
 */
export async function saveListingTitle(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const title = String(formData.get("title") || "").trim().slice(0, 50);
  if (!title) throw new Error("Add a title");

  const existing = await prisma.property.findUniqueOrThrow({ where: { id } });
  const data: { title: string; slug?: string } = { title };

  if (!existing.published) {
    let slug = slugify(title) || `listing-${Date.now().toString(36)}`;
    const clash = await prisma.property.findFirst({
      where: {
        hostId: existing.hostId,
        slug,
        NOT: { id },
      },
    });
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    data.slug = slug;
  }

  await prisma.property.update({ where: { id }, data });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=7`);
}

/**
 * Wizard step 7 → guest-facing description.
 */
export async function saveListingDescription(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const description = String(formData.get("description") || "")
    .trim()
    .slice(0, 500);
  if (description.length < 20) {
    throw new Error("Write a little more so guests know what to expect");
  }

  await prisma.property.update({
    where: { id },
    data: { description },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=8`);
}

/**
 * Wizard step 8 → base nightly rate + weekend premium %.
 */
export async function saveListingPrices(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const baseNightlyRate = Number(formData.get("baseNightlyRate"));
  const weekendPremiumPercent = Number(
    formData.get("weekendPremiumPercent") || 0,
  );

  if (!Number.isFinite(baseNightlyRate) || baseNightlyRate < 1) {
    throw new Error("Enter a base price of at least $1");
  }
  if (
    !Number.isFinite(weekendPremiumPercent) ||
    weekendPremiumPercent < 0 ||
    weekendPremiumPercent > 100
  ) {
    throw new Error("Weekend adjustment should be 0–100%");
  }

  await prisma.property.update({
    where: { id },
    data: {
      baseNightlyRate: Math.round(baseNightlyRate * 100) / 100,
      weekendPremiumPercent: Math.round(weekendPremiumPercent * 10) / 10,
    },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=9`);
}

/**
 * Wizard step 9 → optional stay discounts (fixed promo amounts).
 */
export async function saveListingDiscounts(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const { DISCOUNT_DEFAULTS } = await import("@/lib/listing-discounts");

  await prisma.property.update({
    where: { id },
    data: {
      discountNewListingPercent:
        formData.get("newListing") === "on" ? DISCOUNT_DEFAULTS.newListing : 0,
      discountLastMinutePercent:
        formData.get("lastMinute") === "on" ? DISCOUNT_DEFAULTS.lastMinute : 0,
      discountWeeklyPercent:
        formData.get("weekly") === "on" ? DISCOUNT_DEFAULTS.weekly : 0,
      discountMonthlyPercent:
        formData.get("monthly") === "on" ? DISCOUNT_DEFAULTS.monthly : 0,
    },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  redirect(`/admin/properties/${id}/setup?step=10`);
}

/**
 * Wizard step 10 → go live.
 */
export async function publishListing(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const property = await prisma.property.findUniqueOrThrow({
    where: { id },
    include: { host: { select: { slug: true } } },
  });

  if (!property.title.trim() || property.title === "Untitled listing") {
    throw new Error("Add a title before publishing");
  }
  if (!property.city && !property.address) {
    throw new Error("Add a location before publishing");
  }
  if (!property.baseNightlyRate || property.baseNightlyRate < 1) {
    throw new Error("Set a nightly price before publishing");
  }

  await prisma.property.update({
    where: { id },
    data: { published: true },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath(`/h/${property.host.slug}`);
  revalidatePath("/marketplace");
  redirect(`/admin/properties/${id}/setup?step=done`);
}

/** Quick pricing sidebar on admin listing calendar (no redirect). */
export async function updatePropertyPricing(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("propertyId") || formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const baseNightlyRate = Number(formData.get("baseNightlyRate"));
  const weekendPremiumPercent = Number(
    formData.get("weekendPremiumPercent") || 0,
  );
  const cleaningFee = Number(formData.get("cleaningFee") || 0);
  const petFee = Number(formData.get("petFee") || 0);
  const petFeeUnitRaw = String(formData.get("petFeeUnit") || "PER_STAY");
  const petFeeUnit = petFeeUnitRaw === "PER_PET" ? "PER_PET" : "PER_STAY";
  const maxPets = Number(
    formData.get("maxPets") != null && String(formData.get("maxPets")) !== ""
      ? formData.get("maxPets")
      : 2,
  );
  const defaultMinNights = Number(formData.get("defaultMinNights") || 1);

  if (!Number.isFinite(baseNightlyRate) || baseNightlyRate < 1) {
    throw new Error("Enter a base price of at least $1");
  }
  if (
    !Number.isFinite(weekendPremiumPercent) ||
    weekendPremiumPercent < 0 ||
    weekendPremiumPercent > 100
  ) {
    throw new Error("Weekend premium should be 0–100%");
  }
  if (!Number.isFinite(cleaningFee) || cleaningFee < 0) {
    throw new Error("Cleaning fee must be 0 or more");
  }
  if (!Number.isFinite(petFee) || petFee < 0) {
    throw new Error("Pet fee must be 0 or more");
  }
  if (!Number.isFinite(maxPets) || maxPets < 0 || maxPets > 20) {
    throw new Error("Max pets must be between 0 and 20 (0 = no fixed cap)");
  }
  if (
    !Number.isFinite(defaultMinNights) ||
    defaultMinNights < 1 ||
    defaultMinNights > 30
  ) {
    throw new Error("Minimum nights must be between 1 and 30");
  }

  const property = await prisma.property.update({
    where: { id },
    data: {
      baseNightlyRate: Math.round(baseNightlyRate * 100) / 100,
      weekendPremiumPercent: Math.round(weekendPremiumPercent * 10) / 10,
      cleaningFee: Math.round(cleaningFee * 100) / 100,
      petFee: Math.round(petFee * 100) / 100,
      petFeeUnit,
      maxPets: Math.round(maxPets),
      defaultMinNights: Math.round(defaultMinNights),
    },
    include: { host: true },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath("/marketplace");
  revalidatePath(`/h/${property.host.slug}`);
  revalidatePath(`/h/${property.host.slug}/properties/${property.slug}`);
}

export async function updateProperty(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);

  const existing = await prisma.property.findUnique({
    where: { id },
    include: { host: true },
  });
  if (!existing) throw new Error("Property not found");

  const locationId = String(formData.get("locationId") || "") || null;
  if (locationId) {
    const loc = await prisma.location.findFirst({
      where: {
        id: locationId,
        ...(access.isPlatform ? {} : { hostId: access.hostId! }),
      },
    });
    if (!loc) throw new Error("Invalid location");
  }

  // Marketplace is optional for every host (paid and free self-host)
  const listOnMarketplace = formData.get("listOnMarketplace") === "on";

  const property = await prisma.property.update({
    where: { id },
    data: {
      title: String(formData.get("title") || "").trim(),
      tagline: String(formData.get("tagline") || "") || null,
      description: String(formData.get("description") || "") || null,
      address: String(formData.get("address") || "") || null,
      city: String(formData.get("city") || "") || null,
      region: String(formData.get("region") || "") || null,
      country: String(formData.get("country") || "") || null,
      postalCode: String(formData.get("postalCode") || "") || null,
      bedrooms: Number(formData.get("bedrooms") || 1),
      bathrooms: Number(formData.get("bathrooms") || 1),
      maxGuests: Number(formData.get("maxGuests") || 2),
      beds: Number(formData.get("beds") || 1),
      baseNightlyRate: Number(formData.get("baseNightlyRate") || 0),
      defaultMinNights: Number(formData.get("defaultMinNights") || 1),
      cleaningFee: Number(formData.get("cleaningFee") || 0),
      petFee: Number(formData.get("petFee") || 0),
      petFeeUnit:
        String(formData.get("petFeeUnit") || "PER_STAY") === "PER_PET"
          ? "PER_PET"
          : "PER_STAY",
      petsAllowed: formData.get("petsAllowed") === "on",
      maxPets: Math.max(
        0,
        Math.min(
          20,
          Math.round(
            Number(
              formData.get("maxPets") != null &&
                String(formData.get("maxPets")) !== ""
                ? formData.get("maxPets")
                : 2,
            ),
          ),
        ),
      ),
      depositPercent: Number(formData.get("depositPercent") || 30),
      checkInTime: parseTimeTo24h(
        String(formData.get("checkInTime") || ""),
        "15:00",
      ),
      checkOutTime: parseTimeTo24h(
        String(formData.get("checkOutTime") || ""),
        "11:00",
      ),
      houseRules: String(formData.get("houseRules") || "") || null,
      disclaimer: String(formData.get("disclaimer") || "") || null,
      published: formData.get("published") === "on",
      featured: formData.get("featured") === "on",
      listOnMarketplace,
      locationId,
    },
    include: { host: true },
  });

  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${id}`);
  revalidatePath("/properties");
  revalidatePath("/marketplace");
  revalidatePath(`/h/${property.host.slug}`);
  revalidatePath(`/h/${property.host.slug}/properties/${property.slug}`);
}

export async function deleteProperty(formData: FormData) {
  const access = await ensureHostAccess();
  const { canDeleteListings, resolveHostAccessInfo } = await import(
    "@/lib/host-access"
  );
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canDeleteListings(info)) {
    throw new Error("Your access level cannot delete listings");
  }
  const id = String(formData.get("id") || "");
  await assertPropertyAccess(id, access);
  await prisma.property.delete({ where: { id } });
  revalidatePath("/admin/properties");
  revalidatePath("/marketplace");
  redirect("/admin/properties");
}

export async function addSeason(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
  });

  const startRaw = String(formData.get("startDate") || "");
  const endRaw = String(formData.get("endDate") || "");
  if (!startRaw || !endRaw) throw new Error("Start and end dates required");

  const startDate = new Date(startRaw + "T00:00:00");
  const endDate = new Date(endRaw + "T00:00:00");
  if (endDate < startDate) {
    throw new Error("End date must be on or after start date");
  }

  const rateRaw = formData.get("nightlyRate");
  const nightlyRate =
    rateRaw === null || rateRaw === ""
      ? property.baseNightlyRate
      : Number(rateRaw);
  if (!Number.isFinite(nightlyRate) || nightlyRate < 0) {
    throw new Error("Invalid nightly rate");
  }

  const minNights = Math.max(
    1,
    Math.min(30, Number(formData.get("minNights") || 1)),
  );

  await prisma.seasonalPrice.create({
    data: {
      propertyId,
      name: String(formData.get("name") || "Season").trim() || "Season",
      startDate,
      endDate,
      nightlyRate,
      minNights,
      holidayKey: String(formData.get("holidayKey") || "").trim() || null,
    },
  });
  revalidatePath(`/admin/properties/${propertyId}`);
}

/**
 * Apply selected peak holidays. Skips keys that already exist.
 * minNights: 0 = no peak min (listing defaultMinNights still applies);
 * 2–7 = peak minimum (Math.max with default at quote time).
 * Unchecked holidays are left off entirely (not peak windows).
 */
export async function applyPeakHolidays(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const property = await prisma.property.findUniqueOrThrow({
    where: { id: propertyId },
  });

  const { upcomingPeakHolidays, peakSeasonName, DEFAULT_PEAK_MIN_NIGHTS } =
    await import("@/lib/peak-holidays");

  const selected = formData.getAll("holidayKey").map(String);
  if (selected.length === 0) {
    throw new Error("Pick at least one peak holiday");
  }

  const rawMin = Number(formData.get("minNights"));
  // 0 = default only (no peak uplift); 1–30 = explicit peak min
  const minNights = Number.isFinite(rawMin)
    ? Math.max(0, Math.min(30, Math.floor(rawMin)))
    : DEFAULT_PEAK_MIN_NIGHTS;

  const catalog = upcomingPeakHolidays();
  const existing = await prisma.seasonalPrice.findMany({
    where: { propertyId, holidayKey: { not: null } },
    select: { holidayKey: true },
  });
  const have = new Set(existing.map((e) => e.holidayKey));

  for (const key of selected) {
    if (have.has(key)) continue;
    const holiday = catalog.find((h) => h.key === key);
    if (!holiday) continue;
    await prisma.seasonalPrice.create({
      data: {
        propertyId,
        name: peakSeasonName(holiday),
        holidayKey: holiday.key,
        startDate: new Date(holiday.startDate + "T00:00:00"),
        endDate: new Date(holiday.endDate + "T00:00:00"),
        nightlyRate: property.baseNightlyRate,
        minNights,
      },
    });
  }

  revalidatePath(`/admin/properties/${propertyId}`);
}

/** Upgrade one peak / season min nights (0 = default only; 2 → 3, etc.). */
export async function updateSeasonMinNights(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const rawMin = Number(formData.get("minNights"));
  const minNights = Number.isFinite(rawMin)
    ? Math.max(0, Math.min(30, Math.floor(rawMin)))
    : 1;

  const season = await prisma.seasonalPrice.findFirst({
    where: { id, propertyId },
  });
  if (!season) throw new Error("Season not found");

  await prisma.seasonalPrice.update({
    where: { id },
    data: { minNights },
  });
  revalidatePath(`/admin/properties/${propertyId}`);
}

/** Set min nights on all peak holidays for this property (0 = default only). */
export async function upgradeAllPeakMinNights(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const rawMin = Number(formData.get("minNights"));
  const minNights = Number.isFinite(rawMin)
    ? Math.max(0, Math.min(30, Math.floor(rawMin)))
    : 3;

  await prisma.seasonalPrice.updateMany({
    where: { propertyId, holidayKey: { not: null } },
    data: { minNights },
  });
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function deleteSeason(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  await prisma.seasonalPrice.delete({ where: { id } });
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function addCalendarBlock(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const guestEmail = String(formData.get("guestEmail") || "").trim() || null;
  const guestPhone = String(formData.get("guestPhone") || "").trim() || null;
  const amountRaw = String(formData.get("invoiceAmount") || "").trim();
  const invoiceAmount =
    amountRaw && Number.isFinite(Number(amountRaw))
      ? Number(amountRaw)
      : null;

  const block = await prisma.calendarBlock.create({
    data: {
      propertyId,
      source: "MANUAL",
      startDate: new Date(String(formData.get("startDate")) + "T00:00:00"),
      endDate: new Date(String(formData.get("endDate")) + "T00:00:00"),
      blockType: String(formData.get("blockType") || "OTHER") as
        | "OWNER"
        | "FRIENDS"
        | "MAINTENANCE"
        | "OFFLINE"
        | "OTHER",
      occupantName: String(formData.get("occupantName") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      guestEmail,
      guestPhone,
      invoiceAmount,
    },
  });

  // Optional: create + email Stripe invoice immediately
  if (formData.get("sendInvoice") === "on" && guestEmail && invoiceAmount) {
    const { sendStripeInvoiceForBlock } = await import("@/lib/block-invoice");
    await sendStripeInvoiceForBlock({
      blockId: block.id,
      amount: invoiceAmount,
      guestEmail,
      guestName: String(formData.get("occupantName") || "").trim() || null,
    });
  }

  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function sendCalendarBlockInvoice(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const block = await prisma.calendarBlock.findFirst({
    where: { id, propertyId },
  });
  if (!block) throw new Error("Block not found");

  const guestEmail =
    String(formData.get("guestEmail") || "").trim() ||
    block.guestEmail ||
    "";
  const amount = Number(
    formData.get("invoiceAmount") || block.invoiceAmount || 0,
  );

  const { sendStripeInvoiceForBlock } = await import("@/lib/block-invoice");
  await sendStripeInvoiceForBlock({
    blockId: id,
    amount,
    guestEmail,
    guestName:
      String(formData.get("occupantName") || "").trim() ||
      block.occupantName,
  });

  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function markCalendarBlockInvoicePaid(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);

  const block = await prisma.calendarBlock.findFirst({
    where: { id, propertyId },
  });
  if (!block) throw new Error("Block not found");

  // If open in Stripe, try to mark paid there too (POS / cash recorded offline)
  if (block.stripeInvoiceId) {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    if (stripe) {
      try {
        await stripe.invoices.pay(block.stripeInvoiceId, {
          paid_out_of_band: true,
        });
      } catch {
        // Already paid or not payable - still mark local
      }
    }
  }

  const { markBlockInvoicePaid } = await import("@/lib/block-invoice");
  await markBlockInvoicePaid(id);
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function deleteCalendarBlock(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  await prisma.calendarBlock.delete({ where: { id } });
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function addIcalImport(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  await prisma.icalConnection.create({
    data: {
      propertyId,
      name: String(formData.get("name") || "Airbnb").trim(),
      importUrl: String(formData.get("importUrl") || "").trim() || null,
      enabled: true,
    },
  });
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function deleteIcalConnection(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  await prisma.icalConnection.delete({ where: { id } });
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function syncIcalNow(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  const { syncIcalConnection } = await import("@/lib/ical");
  await syncIcalConnection(id);
  revalidatePath(`/admin/properties/${propertyId}`);
}

export async function uploadPropertyImage(formData: FormData) {
  const access = await ensureHostAccess();
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  const file = formData.get("file") as File | null;
  if (!file || !propertyId) throw new Error("Missing file");

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", propertyId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), bytes);

  const count = await prisma.propertyImage.count({ where: { propertyId } });
  await prisma.propertyImage.create({
    data: {
      propertyId,
      url: `/uploads/${propertyId}/${filename}`,
      alt: String(formData.get("alt") || "") || null,
      sortOrder: count,
      isCover: count === 0,
    },
  });

  revalidatePath(`/admin/properties/${propertyId}`);
  revalidatePath("/properties");
  revalidatePath("/marketplace");
}

export async function deletePropertyImage(formData: FormData) {
  const access = await ensureHostAccess();
  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  await assertPropertyAccess(propertyId, access);
  await prisma.propertyImage.delete({ where: { id } });
  revalidatePath(`/admin/properties/${propertyId}`);
}
