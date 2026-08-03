/**
 * Map custom hostnames → host slug for multi-tenant domain routing.
 *
 * Sources (merged):
 * 1) HOST_DOMAIN_MAP env (comma-separated domain:slug) — ops / Railway
 * 2) Host.customDomain rows via /api/domain-map (self-serve brand admin)
 *
 * Format (env):
 *   HOST_DOMAIN_MAP=cherokeelanding.net:cherokee-landing,www.example.com:other
 *
 * www / bare domain both work if either is listed.
 */
export function parseHostDomainMap(
  raw: string | undefined | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!raw?.trim()) return map;

  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const domain = trimmed.slice(0, colon).trim().toLowerCase();
    const slug = trimmed.slice(colon + 1).trim().toLowerCase();
    if (!domain || !slug) continue;

    const bare = domain.replace(/^www\./, "");
    map[bare] = slug;
    map[`www.${bare}`] = slug;
    map[domain] = slug;
  }
  return map;
}

/** Normalize user input to bare hostname (no protocol/path). */
export function normalizeCustomDomain(
  raw: string | null | undefined,
): string | null {
  const t = (raw || "").trim().toLowerCase();
  if (!t) return null;
  const hostOnly = t
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.replace(/\.$/, "");
  if (!hostOnly || hostOnly.includes(" ") || !hostOnly.includes(".")) {
    return null;
  }
  if (hostOnly === "localhost" || hostOnly.endsWith(".railway.app")) {
    return null;
  }
  // Store bare domain; map adds www. automatically
  return hostOnly.replace(/^www\./, "");
}

/** HOST_DOMAIN_MAP snippet for one host (ops / docs). */
export function domainMapSnippet(domain: string, slug: string): string {
  const bare = domain.replace(/^www\./, "").toLowerCase();
  return `${bare}:${slug},www.${bare}:${slug}`;
}

export function hostSlugForHostname(
  hostname: string | null | undefined,
  mapRaw?: string | null,
  extraMap?: Record<string, string> | null,
): string | null {
  if (!hostname) return null;
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (!host || host === "localhost" || host.endsWith(".railway.app")) {
    // Main platform hostnames are not remapped
    if (host.endsWith(".railway.app") || host === "localhost") return null;
  }
  // yallcomeback.com production apex stays platform
  if (
    host === "yallcomeback.com" ||
    host === "www.yallcomeback.com"
  ) {
    return null;
  }
  const map = {
    ...parseHostDomainMap(mapRaw ?? process.env.HOST_DOMAIN_MAP ?? ""),
    ...(extraMap || {}),
  };
  const bare = host.replace(/^www\./, "");
  return map[host] || map[bare] || map[`www.${bare}`] || null;
}

let domainMapCache: { at: number; map: Record<string, string> } | null = null;
const DOMAIN_MAP_TTL_MS = 60_000;

/**
 * Env map + optional DB map (fetched from platform /api/domain-map).
 * Safe for middleware: short timeout, falls back to env-only.
 */
export async function resolveHostSlugForHostname(
  hostname: string | null | undefined,
): Promise<string | null> {
  const fromEnv = hostSlugForHostname(hostname);
  if (fromEnv) return fromEnv;
  if (!hostname) return null;

  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".railway.app") ||
    host === "yallcomeback.com" ||
    host === "www.yallcomeback.com"
  ) {
    return null;
  }

  const extra = await loadDbDomainMap();
  return hostSlugForHostname(hostname, null, extra);
}

async function loadDbDomainMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (domainMapCache && now - domainMapCache.at < DOMAIN_MAP_TTL_MS) {
    return domainMapCache.map;
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : null);
  if (!base) return {};

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base}/api/domain-map`, {
      signal: ctrl.signal,
      // Avoid recursive middleware on same origin if misconfigured
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    } as RequestInit);
    clearTimeout(t);
    if (!res.ok) return domainMapCache?.map || {};
    const map = (await res.json()) as Record<string, string>;
    domainMapCache = { at: now, map: map || {} };
    return domainMapCache.map;
  } catch {
    return domainMapCache?.map || {};
  }
}

/** Paths that always stay on the platform (never rewritten to a host site). */
export function isPlatformPath(pathname: string): boolean {
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/ops") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/help") ||
    pathname.startsWith("/open-source") ||
    pathname.startsWith("/for-hosts") ||
    pathname.startsWith("/self-host") ||
    pathname.startsWith("/brand") ||
    pathname.startsWith("/seed") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/apple-touch-icon.png"
  ) {
    return true;
  }
  // opengraph-image / twitter-image intentionally NOT platform-only so custom
  // domains receive x-tenant-slug and can render host-branded cards.
  // static files
  if (pathname.includes(".") && !pathname.startsWith("/marketplace")) {
    return true;
  }
  return false;
}
