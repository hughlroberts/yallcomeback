/**
 * Seed a richer private PricingMarketComp set for Cedar Creek / E. Texas style
 * comps. Never guest-facing.
 *
 *   DATABASE_URL=... npx tsx scripts/seed-rich-pricing-comps.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Seed = {
  key: string;
  title: string;
  tagline?: string;
  description: string;
  maxGuests: number;
  bedrooms: number;
  bathrooms?: number;
  baseNightlyRate: number;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  sourceNote?: string;
};

const SEEDS: Seed[] = [
  // —— Waterfront prime, sleeps 7–11 (core for 9-guest dock homes) ——
  {
    key: "ccl-prime-dock-9",
    title: "Log Cabin Lakefront with Covered Dock",
    tagline: "Private covered dock · open water view",
    description:
      "Waterfront home near Log Cabin with private covered dock, deep water, open lake view. Sleeps 9.",
    maxGuests: 9,
    bedrooms: 2,
    baseNightlyRate: 310,
    city: "Log Cabin",
    region: "Texas",
    latitude: 32.25,
    longitude: -96.12,
    amenities: ["waterfront", "private_dock", "lake_view", "fire_pit", "wifi"],
  },
  {
    key: "ccl-waterfront-dock-8",
    title: "Cedar Creek Waterfront Cottage with Private Dock",
    tagline: "Lakefront, private dock, sandy swim area",
    description:
      "Private dock and deep water on Cedar Creek Lake. Waterfront living room views. Sleeps 8.",
    maxGuests: 8,
    bedrooms: 3,
    baseNightlyRate: 265,
    city: "Gun Barrel City",
    region: "Texas",
    latitude: 32.335,
    longitude: -96.145,
    amenities: ["waterfront", "private_dock", "lake_view", "wifi", "kitchen"],
  },
  {
    key: "ccl-beachfront-pontoon-10",
    title: "Lakefront Retreat · Beach Access & Boat Slip",
    tagline: "True lake frontage with boat slip",
    description:
      "Beachfront house on Cedar Creek with private boat slip and sandy bottom swimming. Sleeps 10.",
    maxGuests: 10,
    bedrooms: 3,
    baseNightlyRate: 325,
    city: "Tool",
    region: "Texas",
    latitude: 32.28,
    longitude: -96.17,
    amenities: [
      "waterfront",
      "beach_access",
      "boat_dock",
      "private_dock",
      "wifi",
    ],
  },
  {
    key: "ccl-sandy-dock-9b",
    title: "East Texas Lakehouse · Sandy Bottom Dock",
    description:
      "Lakefront with private dock and sandy bottom swim area. Open water views, sleeps 9. Game room.",
    maxGuests: 9,
    bedrooms: 3,
    baseNightlyRate: 295,
    city: "Malakoff",
    region: "Texas",
    latitude: 32.17,
    longitude: -96.01,
    amenities: ["waterfront", "private_dock", "lake_view", "wifi", "kitchen"],
  },
  {
    key: "ccl-prime-dock-10-game",
    title: "Waterfront Family Compound with Double Dock",
    description:
      "On the water with private double dock, deep water for boats. Sleeps 10. Hot tub on deck.",
    maxGuests: 10,
    bedrooms: 4,
    baseNightlyRate: 375,
    city: "Gun Barrel City",
    region: "Texas",
    latitude: 32.34,
    longitude: -96.15,
    amenities: [
      "waterfront",
      "private_dock",
      "lake_view",
      "hot_tub",
      "wifi",
    ],
  },
  {
    key: "ccl-prime-dock-8-cabin",
    title: "Cedar Creek Cabin on the Water",
    description:
      "True waterfront cabin with private dock and fishing. Sleeps 8. Fire pit by the lake.",
    maxGuests: 8,
    bedrooms: 2,
    baseNightlyRate: 245,
    city: "Seven Points",
    region: "Texas",
    latitude: 32.32,
    longitude: -96.2,
    amenities: ["waterfront", "private_dock", "fire_pit", "wifi"],
  },
  {
    key: "ccl-prime-dock-11",
    title: "Large Lakefront Lodge · Private Pier",
    description:
      "Spacious waterfront lodge with private pier and boat lift. Sleeps 11. Open lake view.",
    maxGuests: 11,
    bedrooms: 4,
    baseNightlyRate: 420,
    city: "Tool",
    region: "Texas",
    latitude: 32.29,
    longitude: -96.16,
    amenities: ["waterfront", "private_dock", "boat_dock", "lake_view", "wifi"],
  },
  {
    key: "ccl-prime-dock-7",
    title: "Cozy Waterfront Bungalow with Slip",
    description:
      "Smaller waterfront bungalow with private boat slip. Sleeps 7. Sandy swim area.",
    maxGuests: 7,
    bedrooms: 2,
    baseNightlyRate: 220,
    city: "Log Cabin",
    region: "Texas",
    latitude: 32.255,
    longitude: -96.125,
    amenities: ["waterfront", "private_dock", "beach_access", "wifi"],
  },
  {
    key: "ccl-prime-dock-9-pool",
    title: "Lakefront + Pool · Private Dock",
    description:
      "Waterfront with private dock AND private pool. Sleeps 9. Premium lake stay.",
    maxGuests: 9,
    bedrooms: 3,
    baseNightlyRate: 395,
    city: "Gun Barrel City",
    region: "Texas",
    latitude: 32.33,
    longitude: -96.14,
    amenities: [
      "waterfront",
      "private_dock",
      "pool",
      "lake_view",
      "wifi",
    ],
  },
  {
    key: "ccl-prime-dock-10-modern",
    title: "Modern Lake House on Open Water",
    description:
      "New-build waterfront with private dock, deep water, panoramic lake view. Sleeps 10.",
    maxGuests: 10,
    bedrooms: 3,
    baseNightlyRate: 350,
    city: "Mabank",
    region: "Texas",
    latitude: 32.31,
    longitude: -96.08,
    amenities: ["waterfront", "private_dock", "lake_view", "wifi", "kitchen"],
  },
  // —— Water access / second row (soft comps) ——
  {
    key: "ccl-water-access-8",
    title: "Lake Access Cabin · Shared Pier",
    tagline: "Deeded lake access, shared pier",
    description:
      "One row back with deeded lake access and shared community pier. Sleeps 8.",
    maxGuests: 8,
    bedrooms: 2,
    baseNightlyRate: 195,
    city: "Seven Points",
    region: "Texas",
    latitude: 32.33,
    longitude: -96.21,
    amenities: ["lake_access", "lake_view", "wifi", "kitchen"],
  },
  {
    key: "ccl-water-access-9",
    title: "Second-Row Lake Home · Community Ramp",
    description:
      "Across the street from the lake with community boat ramp access. Sleeps 9. Lake view from upper deck.",
    maxGuests: 9,
    bedrooms: 3,
    baseNightlyRate: 210,
    city: "Log Cabin",
    region: "Texas",
    latitude: 32.252,
    longitude: -96.118,
    amenities: ["lake_access", "lake_view", "wifi"],
  },
  {
    key: "ccl-water-access-10",
    title: "Near the Water Family Home",
    description:
      "Short walk to public boat ramp. Not waterfront. Sleeps 10. Large yard.",
    maxGuests: 10,
    bedrooms: 4,
    baseNightlyRate: 230,
    city: "Tool",
    region: "Texas",
    latitude: 32.275,
    longitude: -96.18,
    amenities: ["lake_access", "wifi", "kitchen", "parking"],
  },
  // —— Inland / pool (soft / contrast) ——
  {
    key: "ccl-inland-pool-10",
    title: "Pool Home Near the Lake (Not Waterfront)",
    tagline: "Private pool · short drive to ramp",
    description:
      "Inland house with private pool about 2 miles from public boat ramp. No dock. Sleeps 10.",
    maxGuests: 10,
    bedrooms: 4,
    bathrooms: 3,
    baseNightlyRate: 240,
    city: "Mabank",
    region: "Texas",
    latitude: 32.36,
    longitude: -96.1,
    amenities: ["pool", "wifi", "kitchen", "parking"],
  },
  {
    key: "ccl-inland-pool-8",
    title: "Suburban Pool House · Drive to Lake",
    description:
      "Inland with private pool. About 3 miles to Cedar Creek. Sleeps 8.",
    maxGuests: 8,
    bedrooms: 3,
    baseNightlyRate: 185,
    city: "Gun Barrel City",
    region: "Texas",
    latitude: 32.35,
    longitude: -96.13,
    amenities: ["pool", "wifi", "kitchen"],
  },
  {
    key: "ccl-inland-9",
    title: "Quiet Country Home near Cedar Creek",
    description:
      "Inland acreage home, no lake access on property. Sleeps 9. Good for groups not needing a dock.",
    maxGuests: 9,
    bedrooms: 3,
    baseNightlyRate: 175,
    city: "Malakoff",
    region: "Texas",
    latitude: 32.2,
    longitude: -95.99,
    amenities: ["wifi", "kitchen", "parking", "fire_pit"],
  },
  // —— More prime variety ——
  {
    key: "ccl-prime-dock-9-budget",
    title: "Older Lakefront Cottage · Private Dock",
    description:
      "Vintage waterfront cottage with private dock. Dated interior but true frontage. Sleeps 9.",
    maxGuests: 9,
    bedrooms: 2,
    baseNightlyRate: 255,
    city: "Seven Points",
    region: "Texas",
    latitude: 32.318,
    longitude: -96.205,
    amenities: ["waterfront", "private_dock", "lake_view", "wifi"],
  },
  {
    key: "ccl-prime-dock-8-premium",
    title: "Designer Waterfront Escape",
    description:
      "High-end waterfront with private dock, deep water, outdoor kitchen. Sleeps 8.",
    maxGuests: 8,
    bedrooms: 3,
    baseNightlyRate: 340,
    city: "Tool",
    region: "Texas",
    latitude: 32.285,
    longitude: -96.165,
    amenities: ["waterfront", "private_dock", "lake_view", "wifi", "kitchen"],
  },
];

async function main() {
  let n = 0;
  for (const s of SEEDS) {
    await prisma.pricingMarketComp.upsert({
      where: { key: s.key },
      create: {
        key: s.key,
        title: s.title,
        tagline: s.tagline ?? null,
        description: s.description,
        amenitiesJson: JSON.stringify(s.amenities),
        maxGuests: s.maxGuests,
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms ?? 2,
        baseNightlyRate: s.baseNightlyRate,
        city: s.city,
        region: s.region,
        latitude: s.latitude,
        longitude: s.longitude,
        active: true,
        sourceNote:
          s.sourceNote ||
          "Private pricing proxy (Cedar Creek area) — not a real listing",
      },
      update: {
        title: s.title,
        tagline: s.tagline ?? null,
        description: s.description,
        amenitiesJson: JSON.stringify(s.amenities),
        maxGuests: s.maxGuests,
        bedrooms: s.bedrooms,
        bathrooms: s.bathrooms ?? 2,
        baseNightlyRate: s.baseNightlyRate,
        city: s.city,
        region: s.region,
        latitude: s.latitude,
        longitude: s.longitude,
        active: true,
      },
    });
    n += 1;
    console.log("·", s.key, "$" + s.baseNightlyRate, "g" + s.maxGuests);
  }
  console.log("Upserted", n, "private comps");
  console.log(
    "Active total:",
    await prisma.pricingMarketComp.count({ where: { active: true } }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
