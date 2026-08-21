/**
 * Create 2 kitchenette + 2 motel room listings for Cherokee Landing.
 * Images: public/seed/kitchenette/* and public/seed/motel/*
 *
 *   DATABASE_URL=... npx tsx scripts/seed-cherokee-kitchenette-motel.ts
 */
import { PrismaClient } from "@prisma/client";
import { readdirSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const HOST_SLUG = "cherokee-landing";

const SHARED = {
  address: "Cherokee Landing Resort, Cedar Creek Lake",
  city: "Malakoff",
  region: "Texas",
  postalCode: "75148",
  country: "United States",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  depositPercent: 30,
  petsAllowed: true,
  petFee: 25,
  petFeeUnit: "PER_STAY" as const,
  maxPets: 2,
  defaultMinNights: 1,
  published: true,
  featured: false,
  listOnMarketplace: true,
  cancellationPolicy: "MODERATE",
  longTermCancellationPolicy: "FIRM",
};

function imageRows(propertyId: string, folder: string, alts: string[]) {
  const dir = path.join(process.cwd(), "public", "seed", folder);
  const files = readdirSync(dir)
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort();
  return files.map((file, i) => ({
    propertyId,
    url: `/seed/${folder}/${file}`,
    alt: alts[i] || `${folder} photo ${i + 1}`,
    sortOrder: i,
  }));
}

async function upsertListing(opts: {
  hostId: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  propertyType: string;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  maxGuests: number;
  baseNightlyRate: number;
  cleaningFee: number;
  amenities: string[];
  sleepingArrangements: string;
  houseRules: string;
  imageFolder: string;
  imageAlts: string[];
  winterRate?: number;
}) {
  const existing = await prisma.property.findFirst({
    where: { hostId: opts.hostId, slug: opts.slug },
    select: { id: true },
  });

  const data = {
    ...SHARED,
    hostId: opts.hostId,
    title: opts.title,
    slug: opts.slug,
    tagline: opts.tagline,
    description: opts.description,
    propertyType: opts.propertyType,
    spaceType: "entire_place",
    bedrooms: opts.bedrooms,
    beds: opts.beds,
    bathrooms: opts.bathrooms,
    maxGuests: opts.maxGuests,
    baseNightlyRate: opts.baseNightlyRate,
    cleaningFee: opts.cleaningFee,
    amenities: JSON.stringify(opts.amenities),
    sleepingArrangements: opts.sleepingArrangements,
    houseRules: opts.houseRules,
  };

  const property = existing
    ? await prisma.property.update({ where: { id: existing.id }, data })
    : await prisma.property.create({ data });

  await prisma.propertyImage.deleteMany({ where: { propertyId: property.id } });
  const imgs = imageRows(property.id, opts.imageFolder, opts.imageAlts);
  if (imgs.length) {
    await prisma.propertyImage.createMany({ data: imgs });
  }

  await prisma.seasonalPrice.deleteMany({ where: { propertyId: property.id } });
  if (opts.winterRate != null) {
    await prisma.seasonalPrice.create({
      data: {
        propertyId: property.id,
        name: "Winter / weekday-friendly season (Nov–Feb)",
        startDate: new Date("2026-11-01T00:00:00"),
        endDate: new Date("2027-02-28T00:00:00"),
        nightlyRate: opts.winterRate,
        minNights: 1,
      },
    });
  }

  // Ensure export iCal exists
  const ical = await prisma.icalConnection.findFirst({
    where: { propertyId: property.id },
  });
  if (!ical) {
    await prisma.icalConnection.create({
      data: {
        propertyId: property.id,
        name: "Export feed",
        enabled: true,
      },
    });
  }

  return { id: property.id, title: property.title, slug: property.slug, images: imgs.length };
}

async function main() {
  const host = await prisma.host.findFirst({
    where: {
      OR: [{ slug: HOST_SLUG }, { name: { contains: "Cherokee" } }],
    },
    select: { id: true, name: true, slug: true },
  });
  if (!host) throw new Error("Cherokee Landing host not found");

  const kitchenetteAmenities = [
    "Kitchenette",
    "Wifi",
    "Air conditioning",
    "Free parking",
    "Patio",
    "Lake access",
    "Beach access",
    "Boat ramp",
    "Fishing pier",
    "Pets allowed",
    "Adjoining room option",
  ];

  const motelAmenities = [
    "Wifi",
    "Air conditioning",
    "Free parking",
    "Lake access",
    "Beach access",
    "Boat ramp",
    "Fishing pier",
    "Pets allowed",
    "Adjoining kitchenette option",
  ];

  const kitchenetteDesc = `One queen bedroom and a full-size bed with a kitchenette at Cherokee Landing on Cedar Creek Lake.

These rooms can open up with an adjoining motel room when you need more space. Outside there is a large patio with plenty of room for the family.

Rates (2 guests): $110 per night. $10 for each additional guest (max 4). Weekdays (Sun–Thu) and winter (Nov–Feb): $90 per night for 2 guests.

Resort amenities include boat rentals, camping, boat launch, swimming area, fishing pier, and fish cleaning station.

Hosted by Cherokee Landing — family-owned resort on Cedar Creek Lake.`;

  const motelDesc = `Comfortable motel room at Cherokee Landing on Cedar Creek Lake. Ideal on its own or adjoining a kitchenette unit when your group needs extra beds.

Rates (2 guests): $75 per night. $10 for each additional guest (max 4 people per room).

Resort amenities include boat rentals, camping, boat launch, swimming area, fishing pier, and fish cleaning station.

Hosted by Cherokee Landing — family-owned resort on Cedar Creek Lake.`;

  const kitchenetteSleep = JSON.stringify([
    { room: "Bedroom", beds: [{ type: "queen", count: 1 }] },
    { room: "Living / sleeping", beds: [{ type: "full", count: 1 }] },
  ]);

  const motelSleep = JSON.stringify([
    { room: "Room", beds: [{ type: "queen", count: 1 }] },
  ]);

  const kitchenetteRules =
    "Check-in after 3:00 PM\nMax 4 guests\n$10 per night each additional guest beyond 2\nPets allowed with fee\nNo parties\nQuiet hours after 10pm\nAsk about adjoining motel room for extra space";

  const motelRules =
    "Check-in after 3:00 PM\nMax 4 guests\n$10 per night each additional guest beyond 2\nPets allowed with fee\nNo parties\nQuiet hours after 10pm\nAsk about adjoining kitchenette for extra space";

  const kitchenetteAlts = [
    "Queen bedroom",
    "Second bed / sleeping area",
    "Kitchenette",
    "Dining area",
    "Bedroom with lake-resort furnishings",
    "Kitchenette unit exterior",
    "Bathroom",
    "Patio picnic table",
    "Covered patio",
    "Patio seating",
    "Outdoor chairs",
    "Patio umbrella",
    "Green patio table",
    "Outdoor lounge",
  ];

  const motelAlts = [
    "Motel exterior placeholder",
    "Motel / lodging area",
    "Motel building exterior",
  ];

  const results = [];

  for (const n of [1, 2] as const) {
    results.push(
      await upsertListing({
        hostId: host.id,
        title: `Kitchenette ${n} @ Cherokee Landing`,
        slug: `kitchenette-${n}`,
        tagline:
          "Queen + full beds, kitchenette, large patio — adjoining motel available",
        description: kitchenetteDesc,
        propertyType: "guesthouse",
        bedrooms: 1,
        beds: 2,
        bathrooms: 1,
        maxGuests: 4,
        baseNightlyRate: 110,
        cleaningFee: 45,
        amenities: kitchenetteAmenities,
        sleepingArrangements: kitchenetteSleep,
        houseRules: kitchenetteRules,
        imageFolder: "kitchenette",
        imageAlts: kitchenetteAlts,
        winterRate: 90,
      }),
    );
  }

  for (const n of [1, 2] as const) {
    results.push(
      await upsertListing({
        hostId: host.id,
        title: `Motel Room ${n} @ Cherokee Landing`,
        slug: `motel-room-${n}`,
        tagline: "Simple motel room on Cedar Creek Lake — adjoining kitchenette available",
        description: motelDesc,
        propertyType: "motel",
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        maxGuests: 4,
        baseNightlyRate: 75,
        cleaningFee: 35,
        amenities: motelAmenities,
        sleepingArrangements: motelSleep,
        houseRules: motelRules,
        imageFolder: "motel",
        imageAlts: motelAlts,
      }),
    );
  }

  console.log(
    JSON.stringify(
      {
        host: { id: host.id, slug: host.slug },
        created: results,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
