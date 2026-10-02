import { safeInternalPath } from "@/lib/safe-redirect";

const GENERIC_LANDING = new Set([
  "",
  "/",
  "/login",
  "/register",
  "/for-hosts",
]);

function pathOnly(path: string): string {
  return path.split("?")[0] || "";
}

/**
 * Where to send someone after sign-in.
 * Hosts land on Calendar unless they were headed into admin/ops/account.
 * Guests land on Find a Place unless they were already on a real page.
 */
export function homeAfterLogin(
  role: string | null | undefined,
  callback?: unknown,
): string {
  const next = typeof callback === "string" && callback.trim()
    ? safeInternalPath(callback, "")
    : "";
  const path = pathOnly(next);
  const isHost = role === "ADMIN" || role === "HOST";

  if (isHost) {
    if (
      path.startsWith("/admin") ||
      path.startsWith("/ops") ||
      path.startsWith("/account")
    ) {
      return next;
    }
    return "/admin/calendar";
  }

  if (next && !GENERIC_LANDING.has(path)) return next;
  return "/marketplace";
}
