/**
 * Set Cherokee services public path to boat-rentals (matches old site).
 * DATABASE_URL=public-proxy npx tsx scripts/set-cherokee-services-path.ts
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const host = await prisma.host.findFirst({
    where: { slug: "cherokee-landing" },
  });
  if (!host) {
    console.error("not found");
    process.exit(1);
  }
  const updated = await prisma.host.update({
    where: { id: host.id },
    data: {
      siteServicesPath: "boat-rentals",
      siteServicesTitle: host.siteServicesTitle || "Boat rentals & lake extras",
      sitePageServices: true,
    },
    select: {
      slug: true,
      siteServicesPath: true,
      siteServicesTitle: true,
    },
  });
  console.log(updated);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
