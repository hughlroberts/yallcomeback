/**
 * Internal-traffic rules for first-party analytics. Edge-safe (no Prisma):
 * middleware, route handlers, and client trackers all import this.
 *
 * - ANALYTICS_EXCLUDE_EMAILS: comma-separated emails, case-insensitive.
 * - ycb_internal cookie: set by ?ycb_test=1, cleared by ?ycb_test=0.
 * - Signed-in ADMIN (platform admin) or HOST (admin dashboard) users.
 * - Users with isInternal = true.
 */
import type { NextRequest, NextResponse } from "next/server";

export const INTERNAL_COOKIE = "ycb_internal";
export const INTERNAL_TEST_PARAM = "ycb_test";
const INTERNAL_MAX_AGE = 60 * 60 * 24 * 365;

export function parseExcludedEmails(
  raw: string | null | undefined = process.env.ANALYTICS_EXCLUDE_EMAILS,
): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const e = part.trim().toLowerCase();
    if (e) out.add(e);
  }
  return [...out];
}

export function isExcludedEmail(
  email: string | null | undefined,
  list: string[] = parseExcludedEmails(),
): boolean {
  const e = email?.trim().toLowerCase();
  if (!e) return false;
  return list.includes(e);
}

/** Roles that work the product (platform admin, host dashboard). */
export function isStaffRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "HOST";
}

export function isInternalAccount(user: {
  isInternal?: boolean | null;
  email?: string | null;
}): boolean {
  return Boolean(user.isInternal) || isExcludedEmail(user.email);
}

export function hasInternalCookieValue(value: string | null | undefined): boolean {
  return value === "1";
}

/** Read ycb_internal from a raw Cookie header (route handlers). */
export function hasInternalCookieHeader(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === INTERNAL_COOKIE) return hasInternalCookieValue(rest.join("="));
  }
  return false;
}

/** Client trackers: true when this browser opted out with ?ycb_test=1. */
export function browserIsInternal(): boolean {
  if (typeof document === "undefined") return false;
  return hasInternalCookieHeader(document.cookie);
}

export function internalCookieOptions() {
  return {
    // Readable by the client tracker so it can skip the beacon. Holds only "1".
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: INTERNAL_MAX_AGE,
  };
}

/** What ?ycb_test= asks for: "set", "clear", or nothing. */
export function internalToggleFromSearch(
  params: URLSearchParams,
): "set" | "clear" | null {
  const v = params.get(INTERNAL_TEST_PARAM)?.trim();
  if (v === "1") return "set";
  if (v === "0") return "clear";
  return null;
}

/** Middleware: apply ?ycb_test=1 / ?ycb_test=0 to the response cookie. */
export function applyInternalCookie(
  req: NextRequest,
  res: NextResponse,
): NextResponse {
  const toggle = internalToggleFromSearch(req.nextUrl.searchParams);
  if (toggle === "set") {
    res.cookies.set(INTERNAL_COOKIE, "1", internalCookieOptions());
  } else if (toggle === "clear") {
    res.cookies.set(INTERNAL_COOKIE, "", { ...internalCookieOptions(), maxAge: 0 });
  }
  return res;
}

/** True when this request should not be tracked because of the cookie or toggle. */
export function requestIsInternal(req: NextRequest): boolean {
  const toggle = internalToggleFromSearch(req.nextUrl.searchParams);
  if (toggle === "set") return true;
  if (toggle === "clear") return false;
  return hasInternalCookieValue(req.cookies.get(INTERNAL_COOKIE)?.value);
}
