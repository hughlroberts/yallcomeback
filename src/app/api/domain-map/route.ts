import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseHostDomainMap } from "@/lib/custom-domains";

/**
 * Public domain → host slug map for middleware multi-tenant routing.
 * Merges env HOST_DOMAIN_MAP with Host.customDomain rows (self-serve).
 * Cached at the edge/CDN for 60s.
 */
export async function GET() {
  const map = parseHostDomainMap(process.env.HOST_DOMAIN_MAP ?? "");

  try {
    const hosts = await prisma.host.findMany({
      where: {
        active: true,
        customDomain: { not: null },
      },
      select: { slug: true, customDomain: true },
      take: 200,
    });
    for (const h of hosts) {
      const raw = h.customDomain?.trim().toLowerCase();
      if (!raw) continue;
      const hostOnly = raw
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        ?.split(":")[0];
      if (!hostOnly) continue;
      const bare = hostOnly.replace(/^www\./, "");
      map[bare] = h.slug;
      map[`www.${bare}`] = h.slug;
      map[hostOnly] = h.slug;
    }
  } catch {
    // DB unavailable — env map only
  }

  return NextResponse.json(map, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
