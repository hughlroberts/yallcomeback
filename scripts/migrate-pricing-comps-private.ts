/**
 * Move demo marketplace peer Properties into private PricingMarketComp,
 * then delete the public demo host so nothing guest-facing remains.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/migrate-pricing-comps-private.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_COMPS = [
  {
    key: "ccl-waterfront-dock-8",
    title: "Cedar Creek Waterfront Cottage with Private Dock",
    tagline: "Lakefront, private dock, sandy swim area",
    description:
      "Private dock and deep water on Cedar Creek Lake. Waterfront living room views. Sleeps 8.",
    maxGuests: 8,
    bedrooms: 3,
    bathrooms: 2,
    baseNightlyRate: 265,
    city: "Gun Barrel City",
    region: "Texas",
    latitude: 32.335,
    longitude: -96.145,
    amenitiesJson: JSON.stringify([
      "waterfront",
      "private_dock",
      "lake_view",
      "wifi",
      "kitchen",
    ]),
    sourceNote: "Private pricing proxy — not a real listing",
  },
  {
    key: "ccl-beachfront-pontoon-10",
    title: "Lakefront Retreat · Beach Access & Boat Slip",
    tagline: "True lake frontage with boat slip",
    description:
      "Beachfront house on Cedar Creek with private boat slip and sandy bottom swimming. Sleeps 10.",
    maxGuests: 10,
    bedrooms: 3,
    bathrooms: 2,
    baseNightlyRate: 325,
    city: "Tool",
    region: "Texas",
    latitude: 32.28,
    longitude: -96.17,
    amenitiesJson: JSON.stringify([
      "waterfront",
      "beach_access",
      "boat_dock",
      "private_dock",
      "wifi",
    ]),
    sourceNote: "Private pricing proxy — not a real listing",
  },
  {
    key: "ccl-prime-dock-9",
    title: "Log Cabin Lakefront with Covered Dock",
    tagline: "Private covered dock · open water view",
    description:
      "Waterfront home near Log Cabin with private covered dock, deep water, open lake view. Sleeps 9.",
    maxGuests: 9,
    bedrooms: 2,
    bathrooms: 2,
    baseNightlyRate: 310,
    city: "Log Cabin",
    region: "Texas",
    latitude: 32.25,
    longitude: -96.12,
    amenitiesJson: JSON.stringify([
      "waterfront",
      "private_dock",
      "lake_view",
      "fire_pit",
      "wifi",
    ]),
    sourceNote: "Private pricing proxy — not a real listing",
  },
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
    amenitiesJson: JSON.stringify(["pool", "wifi", "kitchen", "parking"]),
    sourceNote: "Private pricing proxy — soft comp only",
  },
  {
    key: "ccl-water-access-8",
    title: "Lake Access Cabin · Shared Pier",
    tagline: "Deeded lake access, shared pier",
    description:
      "One row back with deeded lake access and shared community pier. Sleeps 8.",
    maxGuests: 8,
    bedrooms: 2,
    bathrooms: 2,
    baseNightlyRate: 195,
    city: "Seven Points",
    region: "Texas",
    latitude: 32.33,
    longitude: -96.21,
    amenitiesJson: JSON.stringify([
      "lake_access",
      "lake_view",
      "wifi",
      "kitchen",
    ]),
    sourceNote: "Private pricing proxy — water access tier",
  },
] as const;

async function main() {
  console.log("Upserting private PricingMarketComp rows…");
  for (const c of SEED_COMPS) {
    await prisma.pricingMarketComp.upsert({
      where: { key: c.key },
      create: { ...c, active: true },
      update: { ...c, active: true },
    });
    console.log("  ·", c.key, "$" + c.baseNightlyRate);
  }

  const demo = await prisma.host.findFirst({
    where: { slug: "market-comps-demo" },
    select: { id: true, name: true },
  });

  if (demo) {
    const props = await prisma.property.findMany({
      where: { hostId: demo.id },
      select: { id: true, slug: true },
    });
    console.log(
      `Removing public demo host "${demo.name}" (${props.length} properties)…`,
    );

    // Cascades should handle children; delete properties then host explicitly
    for (const p of props) {
      await prisma.pricingRecommendation.deleteMany({
        where: { propertyId: p.id },
      });
      await prisma.property.delete({ where: { id: p.id } });
      console.log("  deleted property", p.slug);
    }
    await prisma.host.delete({ where: { id: demo.id } });
    console.log("  deleted host market-comps-demo");
  } else {
    console.log("No market-comps-demo host found (already clean).");
  }

  // Safety: any leftover comps with that title pattern unpublished
  const leftover = await prisma.property.updateMany({
    where: {
      slug: { startsWith: "comp-ccl-" },
    },
    data: { published: false, listOnMarketplace: false },
  });
  if (leftover.count > 0) {
    console.log("Unpublished leftover comp-* properties:", leftover.count);
  }

  const active = await prisma.pricingMarketComp.count({
    where: { active: true },
  });
  console.log("Done. Active private comps:", active);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
