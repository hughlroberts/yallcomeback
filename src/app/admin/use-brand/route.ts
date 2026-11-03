import { redirectToPath } from "@/lib/path-redirect";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ADMIN_BRAND_COOKIE,
  ADMIN_BRAND_SLUG_COOKIE,
  adminBrandCookieOptions,
} from "@/lib/admin-brand-cookie";
import {
  brandSlugFromParam,
  hostIdFromParam,
  safeAdminReturnTo,
  withoutBrandParam,
} from "@/lib/admin-brand-path";

export const dynamic = "force-dynamic";

/**
 * Platform admin opened /admin/...?brand=<slug> (a bookmark or alert link).
 * Pick that brand, then go back to the same URL. Unknown brand or no access:
 * go back without ?brand= so middleware never loops. The Location is a
 * relative path (see redirectToPath: req.url holds the bind address).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = safeAdminReturnTo(url.searchParams.get("to"));
  const slug = brandSlugFromParam(url.searchParams.get("slug"));
  // T42: /admin/...?hostId=<id> switches by id.
  const hostId = hostIdFromParam(url.searchParams.get("hostId"));

  let host: { id: string; slug: string } | null = null;
  try {
    const session = await requirePlatformAdmin();
    host =
      session && (slug || hostId)
        ? await prisma.host.findUnique({
            where: slug ? { slug } : { id: hostId! },
            select: { id: true, slug: true },
          })
        : null;
  } catch (err) {
    console.error("[admin/use-brand] brand lookup failed", err);
    host = null;
  }

  if (!host) {
    const res = redirectToPath(withoutBrandParam(to));
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const res = redirectToPath(to);
  res.cookies.set(ADMIN_BRAND_COOKIE, host.id, adminBrandCookieOptions());
  res.cookies.set(ADMIN_BRAND_SLUG_COOKIE, host.slug, adminBrandCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  return res;
}
