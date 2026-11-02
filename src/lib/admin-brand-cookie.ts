/** Cookie name only — safe for any bundle (no next/headers). */
export const ADMIN_BRAND_COOKIE = "ycb_admin_brand";
/**
 * Slug of the picked brand (not a secret). Middleware compares it with
 * `?brand=<slug>` so a bookmarked brand URL switches brand only when needed.
 */
export const ADMIN_BRAND_SLUG_COOKIE = "ycb_admin_brand_slug";
/** Route that sets the brand from `?brand=<slug>`, then returns to the page. */
export const ADMIN_USE_BRAND_PATH = "/admin/use-brand";

/** Shared options for both brand cookies. */
export function adminBrandCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
    secure: process.env.NODE_ENV === "production",
  };
}
