/**
 * Allow only same-origin relative paths. Blocks open redirects
 * (`https://evil`, `//evil`, `/\evil`, backslash tricks).
 */
export function safeInternalPath(
  raw: unknown,
  fallback = "/",
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || /[\r\n\0]/.test(value)) return fallback;
  if (value.includes("://")) return fallback;

  try {
    const resolved = new URL(value, "https://yallcomeback.app");
    if (resolved.origin !== "https://yallcomeback.app") return fallback;
    const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
    if (!path.startsWith("/") || path.startsWith("//")) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
