import { safeInternalPath } from "@/lib/safe-redirect";

const GENERIC_LANDING = new Set([
  "",
  "/",
  "/login",
  "/register",
  "/for-hosts",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

function pathOnly(path: string): string {
  return path.split("?")[0] || "";
}

/**
 * Where to send someone after sign-in.
 * Hosts land on Calendar unless they were headed to a specific page
 * (admin, account, a listing, checkout, messages...).
 * Guests land on Find a Place unless they were already on a real page.
 */
export function homeAfterLogin(
  role: string | null | undefined,
  callback?: unknown,
): string {
  const next =
    typeof callback === "string" && callback.trim()
      ? safeInternalPath(callback, "")
      : "";
  const path = pathOnly(next);
  const isHost = role === "ADMIN" || role === "HOST";

  if (isHost) {
    if (path === "/admin") {
      return "/admin/calendar";
    }
    // A host who signed in from a listing, checkout, message, or wishlist
    // was traveling: keep them there (hosts can book stays too). Only bare
    // landings (home, login, the host pitch, the search page) go to Calendar.
    if (next && !GENERIC_LANDING.has(path) && path !== "/marketplace") {
      return next;
    }
    return "/admin/calendar";
  }

  if (next && !GENERIC_LANDING.has(path)) return next;
  return "/marketplace";
}
