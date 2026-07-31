/**
 * Normalize amenities JSON on all properties (drop import junk, use catalog labels).
 */
import { PrismaClient } from "@prisma/client";
import { sanitizeAmenities } from "../src/lib/listing-amenities";

const prisma = new PrismaClient();

function parseAmenities(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

async function main() {
  const properties = await prisma.property.findMany({
    select: { id: true, slug: true, amenities: true },
  });

  for (const prop of properties) {
    const before = parseAmenities(prop.amenities);
    const after = sanitizeAmenities(before);
    // Always re-save cleaned list so UI junk is gone
    await prisma.property.update({
      where: { id: prop.id },
      data: { amenities: JSON.stringify(after) },
    });
    console.log(prop.slug, before.length, "→", after.length, after);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
