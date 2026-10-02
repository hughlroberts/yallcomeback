/**
 * Point the live Lower Eagles Nest listing at durable seed photos.
 * Cover is /seed/lower-eagles/01.jpg (IMG_7780, covered patio).
 *
 * Run on production after the photos are in the image:
 *   railway ssh -- npx tsx scripts/replace-lower-eagles-photos.ts
 */
import { PrismaClient } from "@prisma/client";

const SLUG = "cherokee-landings-lower-eagles-nest-cedar-creek";

const PHOTOS: { url: string; alt: string; isCover: boolean }[] = [
  {
    url: "/seed/lower-eagles/01.jpg",
    alt: "Covered patio looking toward the lake",
    isCover: true,
  },
  {
    url: "/seed/lower-eagles/02.jpg",
    alt: "Lake, dock, and grill from the patio",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/03.jpg",
    alt: "Front door and patio seating",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/04.jpg",
    alt: "Kitchen and dining",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/05.jpg",
    alt: "Kitchen",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/06.jpg",
    alt: "Living room",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/07.jpg",
    alt: "Bathroom with tub",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/08.jpg",
    alt: "Bathroom vanity",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/09.jpg",
    alt: "Bedroom",
    isCover: false,
  },
  {
    url: "/seed/lower-eagles/10.jpg",
    alt: "Second bedroom",
    isCover: false,
  },
];

async function main() {
  const prisma = new PrismaClient();
  const property = await prisma.property.findFirst({
    where: { slug: SLUG },
    select: { id: true, slug: true, title: true },
  });
  if (!property) {
    console.error("Lower Eagles Nest listing not found");
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
