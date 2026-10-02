/**
 * Point both live Cherokee Landing kitchenette listings at the real
 * motel-kitchenette photos. Cover is /seed/kitchenette/02.jpg (fridge / bath).
 *
 * Run on production after the photos are in the image:
 *   railway ssh -i ~/.ssh/railway_ycb -- node prisma/replace-kitchenette-photos.js
 */
import { PrismaClient } from "@prisma/client";

const SLUGS = ["kitchenette-1", "kitchenette-2"];

const PHOTOS: { url: string; alt: string; isCover: boolean }[] = [
  {
    url: "/seed/kitchenette/02.jpg",
    alt: "Kitchenette fridge and bathroom",
    isCover: true,
  },
  {
    url: "/seed/kitchenette/01.jpg",
    alt: "Daybed in the blue bedroom",
    isCover: false,
  },
  {
    url: "/seed/kitchenette/03.jpg",
    alt: "Living area looking into the bedroom",
    isCover: false,
  },
  {
    url: "/seed/kitchenette/04.jpg",
    alt: "Queen bedroom with cabin quilt",
    isCover: false,
  },
  {
    url: "/seed/kitchenette/05.jpg",
    alt: "Dining table and living area",
    isCover: false,
  },
  {
    url: "/seed/kitchenette/06.jpg",
    alt: "Kitchenette rooms from the lawn",
    isCover: false,
  },
  {
    url: "/seed/kitchenette/07.jpg",
    alt: "Boardwalk along the kitchenette rooms toward the lake",
    isCover: false,
  },
];

async function main() {
  const prisma = new PrismaClient();
  const properties = await prisma.property.findMany({
    where: { slug: { in: SLUGS } },
    select: { id: true, slug: true, title: true },
  });
  if (properties.length !== SLUGS.length) {
    console.error("Kitchenette listings missing", {
      found: properties.map((p) => p.slug),
    });
    process.exit(1);
  }

  const results = [];
  for (const property of properties) {
    await prisma.propertyImage.deleteMany({ where: { propertyId: property.id } });
    await prisma.propertyImage.createMany({
      data: PHOTOS.map((p, i) => ({
        propertyId: property.id,
        url: p.url,
        alt: p.alt,
        sortOrder: i,
        isCover: p.isCover,
      })),
    });
    const images = await prisma.propertyImage.findMany({
      where: { propertyId: property.id },
      select: { url: true, isCover: true, sortOrder: true },
      orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
    });
    results.push({
      slug: property.slug,
      imageCount: images.length,
      images,
    });
  }
  console.log(JSON.stringify(results));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
