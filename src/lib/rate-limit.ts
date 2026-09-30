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

export function ipFromHeaders(h: Headers): string {
  return (
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export async function incomingIp(): Promise<string> {
  return ipFromHeaders(await headers());
}

export function incomingIpFromRequest(req: Request): string {
  return ipFromHeaders(req.headers);
}
