import { ADMIN_USE_BRAND_PATH } from "./admin-brand-cookie";

/**
 * After switching the admin brand, do not keep a URL that belongs to the
 * previous host (a Cherokee listing id under Hugh’s listings, etc.).
 */
export function adminBrandSwitchPath(returnTo: string): string {
  const path = (returnTo || "").trim().split("?")[0] || "/admin/calendar";
  if (!path.startsWith("/admin") && !path.startsWith("/ops")) {
    return "/admin/calendar";
  }
  if (/^\/admin\/properties\/[^/]+/.test(path)) return "/admin/properties";
  if (/^\/admin\/magnets\/[^/]+/.test(path)) return "/admin/properties";
  if (/^\/admin\/bookings\/[^/]+/.test(path)) return "/admin/bookings";
  if (/^\/admin\/messages\/[^/]+/.test(path)) return "/admin/messages";
  return path;
}

/**
 * Platform admin with no brand picked sees only the brand chooser in /admin
 * (no listings, stays, bookings, or messages from any brand).
 */
export function shouldShowPickBrandOnly(input: {
  isPlatform: boolean;
  activeBrandId: string | null | undefined;
}): boolean {
  return input.isPlatform && !input.activeBrandId;
}

const BRAND_SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Brand slug from `?brand=`. The old `?brand=1` refresh marker is not a slug. */
export function brandSlugFromParam(raw: string | null | undefined): string | null {
  const v = (raw || "").trim().toLowerCase();
  if (!v || v === "1" || !BRAND_SLUG.test(v)) return null;
  return v;
}

/** Only same-site /admin paths (no `//host`, no other areas). */
export function safeAdminReturnTo(raw: string | null | undefined): string {
  const v = (raw || "").trim();
  if (!v.startsWith("/admin") || v.startsWith("//") || v.includes("\\")) {
    return "/admin";
  }
  return v;
}

/** The same URL without `?brand=` (used when the slug is unknown). */
export function withoutBrandParam(pathWithSearch: string): string {
  const u = new URL(pathWithSearch, "http://x");
  u.searchParams.delete("brand");
  const q = u.searchParams.toString();
  return `${u.pathname}${q ? `?${q}` : ""}`;
}

/**
 * Middleware: a platform admin opens /admin/...?brand=<slug> for a brand that
 * is not the picked one → URL of the route that switches brand and returns.
 * Null when nothing needs to change (old `?brand=1`, same brand, not admin).
 */
export function adminBrandParamRedirect(input: {
  pathname: string;
  search: string;
  role: string | null | undefined;
  slugCookie: string | null | undefined;
}): string | null {
  const { pathname, search, role } = input;
  if (role !== "ADMIN") return null;
  if (!pathname.startsWith("/admin")) return null;
  if (pathname.startsWith(ADMIN_USE_BRAND_PATH)) return null;
  const slug = brandSlugFromParam(new URLSearchParams(search).get("brand"));
  if (!slug) return null;
  if ((input.slugCookie || "").toLowerCase() === slug) return null;
  const to = `${pathname}${search}`;
  return `${ADMIN_USE_BRAND_PATH}?${new URLSearchParams({ slug, to })}`;
}
