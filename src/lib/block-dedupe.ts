/**
 * Double-submit protection for manual calendar blocks.
 * The sheet sends a per-open clientRequestId; the server saves it on the
 * block (unique) and treats a repeat as already done. Forms without a key
 * fall back to "identical block saved within the window".
 */
export const DUPLICATE_BLOCK_WINDOW_MS = 2 * 60 * 1000;

const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** Accept only short url-safe keys (e.g. crypto.randomUUID()); else null. */
export function normalizeClientRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return KEY_RE.test(v) ? v : null;
}

/** Fresh key for one save attempt; works without crypto.randomUUID. */
export function newClientRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
