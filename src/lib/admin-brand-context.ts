import "server-only";
import { cookies } from "next/headers";
import { ADMIN_BRAND_COOKIE } from "@/lib/admin-brand-cookie";

export { ADMIN_BRAND_COOKIE };

/**
 * Active host brand id for platform operators.
 * Hosts never use this — they are always scoped to their own hostId.
 * Server-only: must not be imported from client components or Edge middleware.
 */
export async function getAdminBrandHostId(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(ADMIN_BRAND_COOKIE)?.value?.trim();
  return v || null;
}
