/**
 * Point Cherokee Landing logoUrl at the durable brand asset in the repo.
 * Run against production: railway run npx tsx scripts/set-cherokee-logo.ts
 */
import { PrismaClient } from "@prisma/client";

const LOGO = "/brand/hosts/cherokee-landing-logo.png";

async function main() {
  const prisma = new PrismaClient();
  const host = await prisma.host.findFirst({
    where: {
      OR: [{ slug: "cherokee-landing" }, { name: { contains: "Cherokee" } }],
    },
  });
  if (!host) {
    console.error("Cherokee host not found");
    process.exit(1);
  }
  const updated = await prisma.host.update({
    where: { id: host.id },
    data: { logoUrl: LOGO },
    select: { id: true, slug: true, name: true, logoUrl: true },
  });
  console.log("Updated:", updated);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
