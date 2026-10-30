import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let checks = 0;

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * In-memory sliding window. Fine on the single Railway web process.
 * Returns true when the request is allowed.
 */
export function rateLimitAllow(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  checks += 1;
  if (checks % 200 === 0) prune(now);

  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

/**
 * Railway overwrites X-Real-IP at the edge. CF-Connecting-IP is not set
 * by Railway, so a caller can supply it and would otherwise win over the
 * real address. Use X-Real-IP only.
 */
export function ipFromHeaders(h: Headers): string {
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function incomingIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export function incomingIpFromRequest(req: Request): string {
  return ipFromHeaders(req.headers);
}
