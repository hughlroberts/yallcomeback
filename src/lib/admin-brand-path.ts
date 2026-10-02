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
