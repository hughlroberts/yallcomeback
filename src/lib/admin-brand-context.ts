import { cookies } from "next/headers";

/** Cookie: platform admin “act as this host brand” in /admin. */
export const ADMIN_BRAND_COOKIE = "ycb_admin_brand";

/**
 * Active host brand id for platform operators.
 * Hosts never use this — they are always scoped to their own hostId.
 */
export async function getAdminBrandHostId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(ADMIN_BRAND_COOKIE)?.value?.trim();
  return v || null;
}
