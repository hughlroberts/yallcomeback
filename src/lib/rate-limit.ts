import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let checks = 0;

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export type RateLimitCheck = {
  allowed: boolean;
  /** Seconds until this bucket has room again (0 when allowed). */
  retryAfterSeconds: number;
};

function retrySeconds(resetAt: number, now: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

/**
 * In-memory fixed window. Fine on the single Railway web process.
 * Counts this request when allowed.
 */
export function rateLimitHit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitCheck {
  const now = Date.now();
  checks += 1;
  if (checks % 200 === 0) prune(now);

  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (cur.count >= limit) {
    return { allowed: false, retryAfterSeconds: retrySeconds(cur.resetAt, now) };
  }
  cur.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Same check as rateLimitHit, but does not count this request. */
export function rateLimitPeek(key: string, limit: number): RateLimitCheck {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt || cur.count < limit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: false, retryAfterSeconds: retrySeconds(cur.resetAt, now) };
}

/** Returns true when the request is allowed (and counts it). */
export function rateLimitAllow(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  return rateLimitHit(key, limit, windowMs).allowed;
}

/** Body + headers for an HTTP 429 that names the limit and when to retry. */
export function rateLimitedPayload(input: {
  error: string;
  code: string;
  limit: RateLimitName;
  retryAfterSeconds: number;
}) {
  const retry = Math.max(1, Math.ceil(input.retryAfterSeconds));
  return {
    body: {
      ok: false as const,
      error: input.error,
      code: input.code,
      limit: input.limit,
      retryAfterSeconds: retry,
    },
    headers: { "Retry-After": String(retry) },
  };
}

/** Which limit was hit: a stable id plus its rule (count per window). */
export type RateLimitName = {
  name: string;
  max: number;
  windowSeconds: number;
};

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
