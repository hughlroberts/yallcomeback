"use server";

import { cookies } from "next/headers";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ADMIN_BRAND_COOKIE } from "@/lib/admin-brand-cookie";
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
  const path = `${safeReturn}?brand=1`;

  const jar = await cookies();
  let active: string | null = null;

  if (hostId && hostId !== "all") {
    const host = await prisma.host.findFirst({
      where: { id: hostId },
      select: { id: true },
    });
    if (host) active = host.id;
  }

  if (active) {
    jar.set(ADMIN_BRAND_COOKIE, active, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 days
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    jar.delete(ADMIN_BRAND_COOKIE);
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/ops", "layout");
  // Drop the client router cache so no page keeps the previous brand's data
  refresh();
  return { ok: Boolean(active) || !hostId, path, hostId: active };
}

/** Plain form version (no JS): switch, then go to the target path. */
export async function setAdminBrandContext(formData: FormData) {
  const result = await switchAdminBrand(formData);
  redirect(result.path);
}
