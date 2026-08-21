/**
 * Append shared resort gallery photos to every Cherokee Landing listing.
 * Sources: cherokeelanding.net/pictures/{545954…, rooms-118, lakedayandsunset147}
 *
 *   DATABASE_URL=... npx tsx scripts/add-cherokee-shared-gallery.ts
 */
import { PrismaClient } from "@prisma/client";
import { readdirSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const SHARED_DIR = path.join(process.cwd(), "public", "seed", "cherokee-shared");
const SHARED_PREFIX = "/seed/cherokee-shared/";

const ALTS: Record<string, string> = {
  "01-park.jpg": "Around the park at Cherokee Landing",
  "02-lakeday-sunset.jpg": "Lake day and sunset on Cedar Creek",
  "03-rooms.jpg": "Rooms and lodging at Cherokee Landing",
};

async function main() {
  const host = await prisma.host.findFirst({
    where: {
      OR: [{ slug: "cherokee-landing" }, { name: { contains: "Cherokee" } }],
    },
    select: { id: true, name: true },
  });
  if (!host) throw new Error("Cherokee host not found");

  const files = readdirSync(SHARED_DIR)
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort();
  if (!files.length) throw new Error("No shared images in public/seed/cherokee-shared");

  const properties = await prisma.property.findMany({
    where: { hostId: host.id },
    select: {
      id: true,
      title: true,
      slug: true,
      images: { select: { url: true, sortOrder: true } },
    },
    orderBy: { title: "asc" },
  });

  const summary: { title: string; added: number; total: number }[] = [];

  for (const prop of properties) {
    const existingUrls = new Set(prop.images.map((i) => i.url));
    const maxSort = prop.images.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    let sort = maxSort + 1;
    let added = 0;

    for (const file of files) {
      const url = `${SHARED_PREFIX}${file}`;
      if (existingUrls.has(url)) continue;
      await prisma.propertyImage.create({
        data: {
          propertyId: prop.id,
          url,
          alt: ALTS[file] || "Cherokee Landing resort",
          sortOrder: sort++,
        },
      });
      added += 1;
    }

    summary.push({
      title: prop.title,
      added,
      total: prop.images.length + added,
    });
  }

  console.log(
    JSON.stringify(
      { host: host.name, sharedFiles: files, listings: summary },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
