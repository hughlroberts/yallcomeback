import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const hosts = await p.host.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      listOnMarketplace: true,
      hostingMode: true,
      sitePresence: true,
      _count: { select: { properties: true } },
      users: { select: { email: true, role: true } },
    },
    orderBy: { name: "asc" },
  });
  console.log("HOSTS", JSON.stringify(hosts, null, 2));

  const all = await p.property.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      published: true,
      listOnMarketplace: true,
      host: { select: { slug: true, name: true } },
    },
    orderBy: { title: "asc" },
  });
  console.log("ALL PROPS", JSON.stringify(all, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
