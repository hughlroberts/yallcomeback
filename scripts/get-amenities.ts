import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const prop = await p.property.findFirst({
    where: { slug: "lakefront-with-private-dock-deep-sandy-bottom" },
    select: { id: true, amenities: true, houseRules: true },
  });
  console.log(JSON.stringify(prop, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
