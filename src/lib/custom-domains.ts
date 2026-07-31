/**
 * Map custom hostnames → host slug for multi-tenant domain routing.
 *
 * Format (comma-separated): domain:slug
 * Example:
 *   HOST_DOMAIN_MAP=cherokeelanding.net:cherokee-landing,www.cherokeelanding.net:cherokee-landing
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

export function hostSlugForHostname(
  hostname: string | null | undefined,
  mapRaw?: string | null,
): string | null {
  if (!hostname) return null;
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  if (!host || host === "localhost" || host.endsWith(".railway.app")) {
    // Main platform hostnames are not remapped
    if (host.endsWith(".railway.app") || host === "localhost") return null;
  }
  const map = parseHostDomainMap(
    mapRaw ?? process.env.HOST_DOMAIN_MAP ?? "",
  );
  const bare = host.replace(/^www\./, "");
  return map[host] || map[bare] || map[`www.${bare}`] || null;
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
