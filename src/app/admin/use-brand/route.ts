import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ADMIN_BRAND_COOKIE,
  ADMIN_BRAND_SLUG_COOKIE,
  adminBrandCookieOptions,
} from "@/lib/admin-brand-cookie";
import {
  brandSlugFromParam,
  safeAdminReturnTo,
  withoutBrandParam,
} from "@/lib/admin-brand-path";

export const dynamic = "force-dynamic";

/**
 * Platform admin opened /admin/...?brand=<slug> (a bookmark or alert link).
 * Pick that brand, then go back to the same URL. Unknown brand or no access:
 * go back without ?brand= so middleware never loops.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = safeAdminReturnTo(url.searchParams.get("to"));
  const slug = brandSlugFromParam(url.searchParams.get("slug"));

  const session = await requirePlatformAdmin();
  const host =
    session && slug
      ? await prisma.host.findUnique({
          where: { slug },
          select: { id: true, slug: true },
        })
      : null;

  if (!host) {
    return NextResponse.redirect(new URL(withoutBrandParam(to), url));
  }

  const res = NextResponse.redirect(new URL(to, url));
  res.cookies.set(ADMIN_BRAND_COOKIE, host.id, adminBrandCookieOptions());
  res.cookies.set(ADMIN_BRAND_SLUG_COOKIE, host.slug, adminBrandCookieOptions());
  res.headers.set("Cache-Control", "no-store");
  return res;
}
