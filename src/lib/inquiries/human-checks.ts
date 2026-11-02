import { createHmac, timingSafeEqual } from "crypto";

/**
 * Checks that only apply to the human web form. The agent API skips these
 * (AI agents acting for a real person are allowed); both paths share the
 * content filter, rate limits, and dedupe.
 */

import {
  HONEYPOT_FIELD,
  MIN_FILL_MS,
  STAMP_FIELD,
  TURNSTILE_ACTION,
  TURNSTILE_FIELD,
} from "@/lib/inquiries/fields";

export {
  HONEYPOT_FIELD,
  MIN_FILL_MS,
  STAMP_FIELD,
  TURNSTILE_ACTION,
  TURNSTILE_FIELD,
};
/** Stamps older than this need a fresh form. */
export const MAX_STAMP_AGE_MS = 24 * 60 * 60 * 1000;

function stampSecret(): string {
  const s = process.env.AUTH_SECRET?.trim();
  if (!s) throw new Error("AUTH_SECRET is required for inquiry form stamps");
  return s;
}

function sign(ts: number): string {
  return createHmac("sha256", stampSecret())
    .update(`inquiry-form:${ts}`)
    .digest("hex")
    .slice(0, 32);
}

/** Issued when the form opens: "<ms timestamp>.<hmac>". */
export function issueFormStamp(now = Date.now()): string {
  return `${now}.${sign(now)}`;
}

export type StampCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "bad" | "too_fast" | "expired" };

export function checkFormStamp(
  stamp: string | null | undefined,
  now = Date.now(),
): StampCheck {
  if (!stamp) return { ok: false, reason: "missing" };
  const [tsRaw, mac] = stamp.split(".");
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || !mac) return { ok: false, reason: "bad" };
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "bad" };
  }
  const age = now - ts;
  if (age < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (age > MAX_STAMP_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}

export function honeypotTripped(value: FormDataEntryValue | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/* ---------------- Cloudflare Turnstile (optional) ---------------- */

/**
 * Turnstile is on only when BOTH env vars are set. Values are never logged
 * or returned; the site key is public by design and goes to the browser.
 */
export function turnstileEnabled(): boolean {
  return Boolean(
    process.env.TURNSTILE_SITE_KEY?.trim() &&
    process.env.TURNSTILE_SECRET_KEY?.trim(),
  );
}

export function turnstileSiteKey(): string | null {
  return turnstileEnabled() ? process.env.TURNSTILE_SITE_KEY!.trim() : null;
}

/** Optional comma list of allowed hostnames (e.g. "yallcomeback.com,www.yallcomeback.com"). */
function allowedHostnames(): Set<string> {
  return new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

export type TurnstileResult =
  { ok: true; skipped: boolean } | { ok: false; reason: string };

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: FormDataEntryValue | string | null,
  remoteIp: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!turnstileEnabled()) return { ok: true, skipped: true };
  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, reason: "missing" };
  }
  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!.trim(),
    response: token,
  });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  let result: { success?: boolean; action?: string; hostname?: string };
  try {
    const r = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, reason: "unavailable" };
    result = await r.json();
  } catch {
    // Fail closed: when Turnstile is configured, an unverified form is not sent.
    return { ok: false, reason: "unavailable" };
  }
  if (!result.success) return { ok: false, reason: "failed" };
  if (result.action && result.action !== TURNSTILE_ACTION) {
    return { ok: false, reason: "action" };
  }
  const hosts = allowedHostnames();
  if (hosts.size > 0 && !hosts.has((result.hostname ?? "").toLowerCase())) {
    return { ok: false, reason: "hostname" };
  }
  return { ok: true, skipped: false };
}
