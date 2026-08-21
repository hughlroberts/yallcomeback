/**
 * Upsert public hosting plans to current pricing:
 *   Marketplace only — $5 / published listing / month
 *   Branded website  — $15 / published listing / month (marketplace included)
 *   Complimentary    — $0 (Ops / partners only)
 *
 * Retires legacy slug "listing" ($40).
 *
 *   DATABASE_URL=... npx tsx scripts/upsert-hosting-plans.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const marketplace = await prisma.hostingPlan.upsert({
    where: { slug: "marketplace" },
    create: {
      name: "Marketplace only",
      slug: "marketplace",
      description:
        "$5 per published listing / month. List on Find a Place. No custom brand website. Not a booking commission.",
      monthlyPrice: 5,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    },
    update: {
      name: "Marketplace only",
      description:
        "$5 per published listing / month. List on Find a Place. No custom brand website. Not a booking commission.",
      monthlyPrice: 5,
      pricingModel: "PER_PROPERTY",
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    },
  });

  const branded = await prisma.hostingPlan.upsert({
    where: { slug: "branded" },
    create: {
      name: "Branded website",
      slug: "branded",
      description:
        "$15 per published listing / month. Brand site on your domain; marketplace listing included. Not a booking commission.",
      monthlyPrice: 15,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: true,
      sortOrder: 2,
    },
    update: {
      name: "Branded website",
      description:
        "$15 per published listing / month. Brand site on your domain; marketplace listing included. Not a booking commission.",
      monthlyPrice: 15,
      pricingModel: "PER_PROPERTY",
      isActive: true,
      isDefault: true,
      sortOrder: 2,
    },
  });

  await prisma.hostingPlan.upsert({
    where: { slug: "complimentary" },
    create: {
      name: "Complimentary",
      slug: "complimentary",
      description:
        "Free hosting for your own brand or partner accounts. Still a full platform customer — no monthly fee.",
      monthlyPrice: 0,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: false,
      sortOrder: 99,
    },
    update: {
      name: "Complimentary",
      monthlyPrice: 0,
      isActive: true,
      isDefault: false,
      sortOrder: 99,
    },
  });

  const legacy = await prisma.hostingPlan.findUnique({
    where: { slug: "listing" },
  });
  let movedHosts = 0;
  if (legacy) {
    const moved = await prisma.host.updateMany({
      where: { planId: legacy.id },
      data: { planId: branded.id },
    });
    movedHosts = moved.count;
    await prisma.hostingPlan.update({
      where: { id: legacy.id },
      data: { isActive: false, isDefault: false },
    });
  }

  // Clear default on anything that is not branded
  await prisma.hostingPlan.updateMany({
    where: { slug: { not: "branded" }, isDefault: true },
    data: { isDefault: false },
  });

  console.log("Plans upserted:");
  console.log(`  marketplace → $${marketplace.monthlyPrice} id=${marketplace.id}`);
  console.log(`  branded     → $${branded.monthlyPrice} id=${branded.id}`);
  console.log(`  hosts moved from legacy listing → branded: ${movedHosts}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
