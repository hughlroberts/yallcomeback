import { prisma } from "@/lib/db";
import { marketplacePropertyWhere } from "@/lib/host";

/**
 * Property slugs are unique per host, not globally. Return the subset of
 * `slugs` that more than one marketplace listing uses, so links to those
 * still carry ?host=. Every other slug resolves on its own.
 */
export async function ambiguousMarketplaceSlugs(
  slugs: string[],
): Promise<Set<string>> {
  const unique = [...new Set(slugs.filter(Boolean))];
  if (unique.length === 0) return new Set();
  const where = marketplacePropertyWhere();
  const rows = await prisma.property.groupBy({
    by: ["slug"],
    where: {
      slug: { in: unique },
      published: where.published,
      listOnMarketplace: where.listOnMarketplace,
      host: where.host,
    },
    _count: { _all: true },
  });
  return new Set(rows.filter((r) => r._count._all > 1).map((r) => r.slug));
}
