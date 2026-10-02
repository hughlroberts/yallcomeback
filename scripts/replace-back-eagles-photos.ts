/**
 * Point the live Back Eagles Nest listing at the real cabin photos.
 * Cover is /seed/back-eagles/01.jpg (IMG_7807, cabin exterior and porch).
 *
 * Run on production after the photos are in the image:
 *   railway ssh -i ~/.ssh/railway_ycb -- node prisma/replace-back-eagles-photos.js
 */
import { PrismaClient } from "@prisma/client";

const SLUGS = ["back-eagles-cabin", "back-eagles-nest"];

const PHOTOS: { url: string; alt: string; isCover: boolean }[] = [
  {
    url: "/seed/back-eagles/01.jpg",
    alt: "Cabin exterior and covered porch",
    isCover: true,
  },
  {
    url: "/seed/back-eagles/02.jpg",
    alt: "Lake and dock from the porch",
    isCover: false,
  },
  {
    url: "/seed/back-eagles/03.jpg",
    alt: "Kitchenette and living area from the door",
    isCover: false,
  },
  {
    url: "/seed/back-eagles/04.jpg",
    alt: "Living area with sofa and lighthouse shelf",
    isCover: false,
  },
  {
    url: "/seed/back-eagles/05.jpg",
    alt: "Living area looking toward the front door",
    isCover: false,
  },
  {
    url: "/seed/back-eagles/06.jpg",
    alt: "Bathroom with shower",
    isCover: false,
  },
  {
    url: "/seed/back-eagles/07.jpg",
    alt: "Bedroom with queen bed",
    isCover: false,
  },
  {
    url: "/seed/back-eagles/08.jpg",
    alt: "Kitchenette looking into the bathroom",
    isCover: false,
  },
];

async function main() {
  const prisma = new PrismaClient();
  const property = await prisma.property.findFirst({
    where: { slug: { in: SLUGS } },
    select: { id: true, slug: true, title: true },
  });
  if (!property) {
    console.error("Back Eagles Nest listing not found");
    process.exit(1);
  }

  await prisma.propertyImage.deleteMany({
    where: {
      propertyId: property.id,
      NOT: { url: { startsWith: "/seed/cherokee-shared/" } },
    },
  });
  await prisma.propertyImage.createMany({
    data: PHOTOS.map((p, i) => ({
      propertyId: property.id,
      url: p.url,
      alt: p.alt,
      sortOrder: i,
      isCover: p.isCover,
    })),
  });
  const shared = await prisma.propertyImage.findMany({
    where: {
      propertyId: property.id,
      url: { startsWith: "/seed/cherokee-shared/" },
    },
    orderBy: { sortOrder: "asc" },
  });
  for (let i = 0; i < shared.length; i++) {
    await prisma.propertyImage.update({
      where: { id: shared[i].id },
      data: { sortOrder: PHOTOS.length + i, isCover: false },
    });
  }

  const images = await prisma.propertyImage.findMany({
    where: { propertyId: property.id },
    select: { url: true, isCover: true, sortOrder: true },
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
  });
  console.log(
    JSON.stringify({ slug: property.slug, imageCount: images.length, images }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
