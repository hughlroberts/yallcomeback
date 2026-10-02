/** Nested host pages under Admin → Dashboard. */

export type DashboardNestId =
  | "dashboard"
  | "brand"
  | "payments"
  | "earnings"
  | "templates"
  | "team";

/** Paths that keep the Dashboard top-nav tab active (not Calendar/Listings/…). */
export const DASHBOARD_NEST_PREFIXES = [
  "/admin/brand",
  "/admin/payments",
  "/admin/earnings",
  "/admin/guest-messages",
  "/admin/team",
  "/admin/taxes",
] as const;

function pathOnly(pathname: string): string {
  const raw = pathname.split("?")[0] || "";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw;
}

function under(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function dashboardNestActive(
  pathname: string,
): DashboardNestId | null {
  const path = pathOnly(pathname);
  if (path === "/admin") return "dashboard";
  if (under(path, "/admin/brand")) return "brand";
  if (under(path, "/admin/payments")) return "payments";
  if (under(path, "/admin/earnings") || under(path, "/admin/taxes")) {
    return "earnings";
  }
  if (under(path, "/admin/guest-messages")) return "templates";
  if (under(path, "/admin/team")) return "team";
  return null;
}

export function isDashboardNestPath(pathname: string): boolean {
  return dashboardNestActive(pathname) != null;
}
