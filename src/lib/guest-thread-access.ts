import { createHmac, timingSafeEqual } from "crypto";
import { b64url, fromB64url } from "@/lib/b64url";
import { canonicalSiteOrigin } from "@/lib/features";

/**
 * T21: signed, expiring link that lets a guest without an account read and
 * reply to ONE thread without signing in. Signed with AUTH_SECRET (no new
 * secret); the "guest-thread:" prefix keeps it apart from unsubscribe tokens.
 * The token names the thread and the guest email, so it stops working if the
 * thread's guest email changes. Each new email carries a fresh link.
 */

export const GUEST_THREAD_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret(): string | null {
  return process.env.AUTH_SECRET?.trim() || null;
}

function sign(body: string, key: string): string {
  return b64url(createHmac("sha256", key).update(`guest-thread:${body}`).digest());
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

/** Null when AUTH_SECRET is missing (then emails link to sign-in instead). */
export function createGuestThreadToken(
  conversationId: string,
  guestEmail: string,
  now = Date.now(),
): string | null {
  const key = secret();
  if (!key || !conversationId || !guestEmail.includes("@")) return null;
  const body = b64url(
    JSON.stringify({
      v: 1,
      k: "gt",
      c: conversationId,
      e: normEmail(guestEmail),
      exp: now + GUEST_THREAD_TTL_MS,
    }),
  );
  return `${body}.${sign(body, key)}`;
}

export type GuestThreadCheck =
  | { ok: true; conversationId: string; email: string; expiresAt: number }
  | { ok: false; reason: "invalid" | "expired" };

/** Checks signature + expiry. Callers must still match thread and email. */
export function verifyGuestThreadToken(
  token: string | null | undefined,
  now = Date.now(),
): GuestThreadCheck {
  const key = secret();
  const parts = (token || "").trim().split(".");
  if (!key || parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, reason: "invalid" };
  }
  const [body, sig] = parts;
  try {
    const a = fromB64url(sig);
    const b = fromB64url(sign(body, key));
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid" };
    }
    const p = JSON.parse(fromB64url(body).toString("utf8")) as {
      v?: number;
      k?: string;
      c?: string;
      e?: string;
      exp?: number;
    };
    if (p.v !== 1 || p.k !== "gt" || !p.c || !p.e || typeof p.exp !== "number") {
      return { ok: false, reason: "invalid" };
    }
    if (p.exp < now) return { ok: false, reason: "expired" };
    return { ok: true, conversationId: p.c, email: p.e, expiresAt: p.exp };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

/** Token is valid AND belongs to this thread and its current guest email. */
export function guestTokenMatchesThread(
  check: GuestThreadCheck,
  thread: { id: string; guestEmail: string; opsAlert?: boolean | null },
): boolean {
  return (
    check.ok &&
    !thread.opsAlert &&
    check.conversationId === thread.id &&
    check.email === normEmail(thread.guestEmail)
  );
}

export function guestThreadPath(conversationId: string, token: string): string {
  return `/messages/${encodeURIComponent(conversationId)}/guest?t=${encodeURIComponent(token)}`;
}

/**
 * Inbox path for a guest email: the signed no-login link when the guest has
 * no account, else the normal sign-in thread page.
 */
export function guestReplyPath(thread: {
  id: string;
  guestEmail: string;
  guestUserId: string | null;
}): string {
  if (!thread.guestUserId) {
    const t = createGuestThreadToken(thread.id, thread.guestEmail);
    if (t) return guestThreadPath(thread.id, t);
  }
  return `/messages/${thread.id}`;
}

export function guestThreadUrl(thread: {
  id: string;
  guestEmail: string;
  guestUserId: string | null;
}): string {
  return `${canonicalSiteOrigin()}${guestReplyPath(thread)}`;
}
