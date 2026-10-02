/**
 * Point the live Upper Eagles Nest listing at durable seed photos.
 * Cover is /seed/eagles-nest/01.jpg (lake, dock, and boat houses from the porch).
 *
 * Run on production after the photos are in the image:
 *   railway ssh -- npx tsx scripts/replace-upper-eagles-photos.ts
 */
import { PrismaClient } from "@prisma/client";

const SLUGS = ["eagles-nest-suite", "upper-eagles-nest"];

const PHOTOS: { url: string; alt: string; isCover: boolean }[] = [
  {
    url: "/seed/eagles-nest/01.jpg",
    alt: "Lake, dock, and boat houses from the porch",
    isCover: true,
  },
  {
    url: "/seed/eagles-nest/02.jpg",
    alt: "Covered porch looking toward the lake",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/03.jpg",
    alt: "Covered porch along the cabin",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/04.jpg",
    alt: "Living room, dining, and kitchen",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/05.jpg",
    alt: "Living room",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/06.jpg",
    alt: "Kitchen and dining",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/07.jpg",
    alt: "Bedroom with two beds",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/08.jpg",
    alt: "Bedroom with lake mural",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/09.jpg",
    alt: "Hall to the bath",
    isCover: false,
  },
  {
    url: "/seed/eagles-nest/10.jpg",
    alt: "Bathroom with walk-in shower",
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
    console.error("Upper Eagles Nest listing not found");
    process.exit(1);
  }

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
    orderBy: { sortOrder: "asc" },
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
