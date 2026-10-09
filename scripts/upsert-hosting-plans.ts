/**
 * Upsert public hosting plans to current pricing:
 *   Marketplace only — $12 / published listing / month
 *   Branded website  — $25 / month flat for the whole site (marketplace included)
 *   Complimentary    — $0 (Ops / partners only)
 *
 * Retires legacy slug "listing" ($40).
 *
 *   DATABASE_URL=... npx tsx scripts/upsert-hosting-plans.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  BRANDED_PLAN_DESCRIPTION,
  BRANDED_WEBSITE_USD,
  MARKETPLACE_LISTING_USD,
  MARKETPLACE_PLAN_DESCRIPTION,
} from "../src/lib/hosting-prices";

const prisma = new PrismaClient();

async function main() {
  const marketplace = await prisma.hostingPlan.upsert({
    where: { slug: "marketplace" },
    create: {
      name: "Marketplace only",
      slug: "marketplace",
      description: MARKETPLACE_PLAN_DESCRIPTION,
      monthlyPrice: MARKETPLACE_LISTING_USD,
      pricingModel: "PER_PROPERTY",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: false,
      sortOrder: 1,
    },
    update: {
      name: "Marketplace only",
      description: MARKETPLACE_PLAN_DESCRIPTION,
      monthlyPrice: MARKETPLACE_LISTING_USD,
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
      description: BRANDED_PLAN_DESCRIPTION,
      monthlyPrice: BRANDED_WEBSITE_USD,
      pricingModel: "FLAT",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: true,
      sortOrder: 2,
    },
    update: {
      name: "Branded website",
      description: BRANDED_PLAN_DESCRIPTION,
      monthlyPrice: BRANDED_WEBSITE_USD,
      pricingModel: "FLAT",
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
      pricingModel: "FLAT",
      minProperties: 1,
      currency: "USD",
      isActive: true,
      isDefault: false,
      sortOrder: 99,
    },
    update: {
      name: "Complimentary",
      monthlyPrice: 0,
      pricingModel: "FLAT",
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

  const paidComplimentary = await prisma.host.findMany({
    where: {
      hostingMode: "PLATFORM",
      plan: { monthlyPrice: { lte: 0 } },
      NOT: { stripeSubscriptionStatus: "paused" },
      OR: [
        { stripeSubscriptionStatus: "active" },
        {
          stripeSubscriptionId: { not: null },
          subscriptionStatus: "ACTIVE",
        },
      ],
    },
    select: { id: true, name: true, sitePresence: true },
  });
  let promoted = 0;
  for (const host of paidComplimentary) {
    const paidPlan =
      host.sitePresence === "STAYLOCAL" ? marketplace : branded;
    await prisma.host.update({
      where: { id: host.id },
      data: { planId: paidPlan.id },
    });
    promoted += 1;
    console.log(
      `  promoted ${host.name} off complimentary → ${paidPlan.slug}`,
    );
  }

  console.log("Plans upserted:");
  console.log(
    `  marketplace → $${marketplace.monthlyPrice} ${marketplace.pricingModel} id=${marketplace.id}`,
  );
  console.log(
    `  branded     → $${branded.monthlyPrice} ${branded.pricingModel} id=${branded.id}`,
  );
  console.log(`  hosts moved from legacy listing → branded: ${movedHosts}`);
  console.log(`  complimentary hosts who already paid → paid plan: ${promoted}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
