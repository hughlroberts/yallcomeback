"use server";

import { cookies } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ADMIN_BRAND_COOKIE,
  ADMIN_BRAND_SLUG_COOKIE,
  adminBrandCookieOptions,
} from "@/lib/admin-brand-cookie";
import { adminBrandSwitchPath } from "@/lib/admin-brand-path";

export type AdminBrandSwitchResult = {
  ok: boolean;
  /** Where the client should go after the switch (always under /admin). */
  path: string;
  /** Brand now active, or null when the picker was cleared. */
  hostId: string | null;
};

/**
 * Platform admin: scope /admin to one host brand (Cherokee vs Hugh, etc.).
 * Hosts never call this — they only see their own brand.
 *
 * Sets the brand cookie and returns the target path instead of redirecting.
 * A server-action redirect renders the target in the same response, and the
 * first switch could render with the old (empty) brand. The client switcher
 * navigates and calls router.refresh() after the cookie is in the browser.
 */
export async function switchAdminBrand(
  formData: FormData,
): Promise<AdminBrandSwitchResult> {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/admin");

  const hostId = String(formData.get("hostId") || "").trim();
  const returnTo = String(formData.get("returnTo") || "/admin/calendar").trim();
  const safeReturn = adminBrandSwitchPath(returnTo);

  const jar = await cookies();
  let active: { id: string; slug: string } | null = null;

  if (hostId && hostId !== "all") {
    const host = await prisma.host.findFirst({
      where: { id: hostId },
      select: { id: true, slug: true },
    });
    if (host) active = host;
  }

  if (active) {
    jar.set(ADMIN_BRAND_COOKIE, active.id, adminBrandCookieOptions());
    jar.set(ADMIN_BRAND_SLUG_COOKIE, active.slug, adminBrandCookieOptions());
  } else {
    jar.delete(ADMIN_BRAND_COOKIE);
    jar.delete(ADMIN_BRAND_SLUG_COOKIE);
  }
  // ?brand=<slug> makes the URL bookmarkable per brand; ?brand=1 when cleared
  const path = `${safeReturn}?brand=${active ? encodeURIComponent(active.slug) : "1"}`;

  revalidatePath("/admin", "layout");
  revalidatePath("/ops", "layout");
  // Drop the client router cache so no page keeps the previous brand's data
  refresh();
  return { ok: Boolean(active) || !hostId, path, hostId: active?.id ?? null };
}

/** Plain form version (no JS): switch, then go to the target path. */
export async function setAdminBrandContext(formData: FormData) {
  const result = await switchAdminBrand(formData);
  redirect(result.path);
}
