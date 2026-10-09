/**
 * Point the lakefront-with-private-dock listing at first-party seed photos.
 * Run on production after the photos are in the image:
 *   railway ssh -i ~/.ssh/railway_ycb -- sh -lc 'cd /app && npx tsx scripts/host-lakefront-dock-photos.ts'
 */
import { PrismaClient } from "@prisma/client";

const PROPERTY_ID = "cms8albg30001x12z61z7kl6g";
const PREFIX = "/seed/lakefront-dock/";
const EXPECTED = 22;

async function main() {
  const prisma = new PrismaClient();
  const images = await prisma.propertyImage.findMany({
    where: { propertyId: PROPERTY_ID },
    orderBy: { sortOrder: "asc" },
    select: { id: true, url: true, sortOrder: true, isCover: true },
  });
  const remote = images.filter((i) => i.url.includes("muscache.com"));
  if (remote.length !== EXPECTED) {
    console.error("expected 22 muscache rows", {
      count: remote.length,
      urls: images.map((i) => i.url),
    });
    process.exit(1);
  }

  const updates = [];
  for (let i = 0; i < remote.length; i++) {
    const url = `${PREFIX}${String(i + 1).padStart(2, "0")}.jpg`;
    await prisma.propertyImage.update({
      where: { id: remote[i]!.id },
      data: { url },
    });
    updates.push({ id: remote[i]!.id, to: url, sortOrder: remote[i]!.sortOrder });
  }

  const leftover = await prisma.propertyImage.count({
    where: { url: { contains: "muscache.com" } },
  });
  const hosted = await prisma.propertyImage.findMany({
    where: { propertyId: PROPERTY_ID },
    orderBy: { sortOrder: "asc" },
    select: { url: true, isCover: true, sortOrder: true },
  });
  console.log(
    JSON.stringify({
      updated: updates.length,
      leftoverMuscache: leftover,
      cover: hosted.find((h) => h.isCover)?.url ?? null,
      hosted: hosted.map((h) => h.url),
    }),
  );
  await prisma.$disconnect();
  if (leftover !== 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
