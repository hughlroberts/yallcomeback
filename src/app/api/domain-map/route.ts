import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseHostDomainMap } from "@/lib/custom-domains";
import { planIncludesCustomDomain } from "@/lib/plan-branded-site";

export type DomainMapResponse = {
  domains: Record<string, string>;
  gated: Record<string, string>;
};

function addDomain(
  map: Record<string, string>,
  raw: string,
  slug: string,
) {
  const hostOnly = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0];
  if (!hostOnly) return;
  const bare = hostOnly.replace(/^www\./, "");
  map[bare] = slug;
  map[`www.${bare}`] = slug;
  map[hostOnly] = slug;
}

/**
 * Public domain → host slug map for middleware multi-tenant routing.
 * Merges env HOST_DOMAIN_MAP with Host.customDomain rows (self-serve).
 * Cached at the edge/CDN for 60s.
 *
 * `domains` are brands whose plan includes a custom domain and may be served
 * on that hostname. `gated` are Marketplace-only (or otherwise unentitled)
 * brands that have a domain configured; middleware redirects those requests
 * to the platform /h/<brand>/ demo URL instead of serving the custom domain.
 */
export async function GET() {
  const domains: Record<string, string> = {};
  const gated: Record<string, string> = {};
  const envMap = parseHostDomainMap(process.env.HOST_DOMAIN_MAP ?? "");

  try {
    const envSlugs = [...new Set(Object.values(envMap))];
    const dbHosts = await prisma.host.findMany({
      where: {
        OR: [
          { active: true, customDomain: { not: null } },
          ...(envSlugs.length ? [{ slug: { in: envSlugs } }] : []),
        ],
      },
      select: {
        slug: true,
        customDomain: true,
        hostingMode: true,
        plan: { select: { slug: true } },
      },
      take: 200,
    });
    const bySlug = new Map(dbHosts.map((h) => [h.slug, h]));

    const assign = (raw: string, slug: string) => {
      const host = bySlug.get(slug);
      const allowed = host
        ? planIncludesCustomDomain(host)
        : // Unknown env slug: do not serve on a custom domain until we know the plan.
          false;
      addDomain(allowed ? domains : gated, raw, slug);
    };

    for (const [domain, slug] of Object.entries(envMap)) {
      assign(domain, slug);
    }
    for (const h of dbHosts) {
      const raw = h.customDomain?.trim();
      if (!raw) continue;
      assign(raw, h.slug);
    }
  } catch {
    // DB unavailable — keep the env map serveable (previous behavior).
    for (const [domain, slug] of Object.entries(envMap)) {
      addDomain(domains, domain, slug);
    }
  }

  const body: DomainMapResponse = { domains, gated };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
