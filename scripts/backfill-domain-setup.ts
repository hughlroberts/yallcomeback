/**
 * For hosts that already have customDomain, run provision + Ops alert once.
 *   DATABASE_URL=... npx tsx scripts/backfill-domain-setup.ts
 */
import { PrismaClient } from "@prisma/client";
import { handleCustomDomainChange } from "../src/lib/domain-setup";

const prisma = new PrismaClient();

async function main() {
  const hosts = await prisma.host.findMany({
    where: { customDomain: { not: null } },
    select: {
      id: true,
      name: true,
      customDomain: true,
      domainProvisionStatus: true,
    },
  });
  console.log(`Found ${hosts.length} host(s) with customDomain`);
  for (const h of hosts) {
    console.log(`→ ${h.name} (${h.customDomain}) status=${h.domainProvisionStatus}`);
    await handleCustomDomainChange({
      hostId: h.id,
      previousDomain: null,
      nextDomain: h.customDomain,
    });
    const after = await prisma.host.findUnique({
      where: { id: h.id },
      select: {
        domainProvisionStatus: true,
        domainDnsCnameTarget: true,
        domainProvisionError: true,
      },
    });
    console.log("  after:", after);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
