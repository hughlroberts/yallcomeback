import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GUEST_THREAD_TTL_MS,
  createGuestThreadToken,
  guestReplyPath,
  guestTokenMatchesThread,
  verifyGuestThreadToken,
} from "@/lib/guest-thread-access";
import { createUnsubscribeToken } from "@/lib/notification-prefs";

const CONV = "cmvze9l7n0001pa01ctdbrnmu";
const EMAIL = "guest@example.test";
const thread = { id: CONV, guestEmail: "Guest@Example.test", opsAlert: false };
let saved: string | undefined;

beforeEach(() => {
  saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "test-auth-secret-not-real";
});
afterEach(() => {
  if (saved === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = saved;
});

describe("guest thread link (T21)", () => {
  it("round-trips for its own thread and email", () => {
    const t = createGuestThreadToken(CONV, EMAIL)!;
    const check = verifyGuestThreadToken(t);
    expect(check.ok).toBe(true);
    expect(guestTokenMatchesThread(check, thread)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const t = createGuestThreadToken(CONV, EMAIL)!;
    const [body, sig] = t.split(".");
    const other = Buffer.from(
      JSON.stringify({ v: 1, k: "gt", c: "other", e: EMAIL, exp: Date.now() + 1e9 }),
    ).toString("base64url");
    expect(verifyGuestThreadToken(`${other}.${sig}`).ok).toBe(false);
    expect(verifyGuestThreadToken(`${body}.${sig.slice(0, -2)}xx`).ok).toBe(false);
    expect(verifyGuestThreadToken("").ok).toBe(false);
    expect(verifyGuestThreadToken("a.b.c").ok).toBe(false);
  });

  it("expires after 30 days", () => {
    const now = Date.now();
    const t = createGuestThreadToken(CONV, EMAIL, now)!;
    expect(verifyGuestThreadToken(t, now + GUEST_THREAD_TTL_MS - 1000).ok).toBe(true);
    const late = verifyGuestThreadToken(t, now + GUEST_THREAD_TTL_MS + 1000);
    expect(late).toEqual({ ok: false, reason: "expired" });
  });

  it("does not open another thread, another email, or an alert thread", () => {
    const check = verifyGuestThreadToken(createGuestThreadToken(CONV, EMAIL));
    expect(guestTokenMatchesThread(check, { ...thread, id: "cmother" })).toBe(false);
    expect(
      guestTokenMatchesThread(check, { ...thread, guestEmail: "new@example.test" }),
    ).toBe(false);
    expect(guestTokenMatchesThread(check, { ...thread, opsAlert: true })).toBe(false);
  });

  it("is not accepted under a different secret", () => {
    const t = createGuestThreadToken(CONV, EMAIL)!;
    process.env.AUTH_SECRET = "a-different-secret";
    expect(verifyGuestThreadToken(t).ok).toBe(false);
  });

  it("an unsubscribe token is not a thread token", () => {
    const u = createUnsubscribeToken(EMAIL, "email");
    expect(verifyGuestThreadToken(u).ok).toBe(false);
  });

  it("without AUTH_SECRET there is no token and emails link to sign-in", () => {
    delete process.env.AUTH_SECRET;
    expect(createGuestThreadToken(CONV, EMAIL)).toBeNull();
    expect(
      guestReplyPath({ id: CONV, guestEmail: EMAIL, guestUserId: null }),
    ).toBe(`/messages/${CONV}`);
  });

  it("only guests without an account get the no-login link", () => {
    expect(
      guestReplyPath({ id: CONV, guestEmail: EMAIL, guestUserId: null }),
    ).toMatch(new RegExp(`^/messages/${CONV}/guest\\?t=`));
    expect(
      guestReplyPath({ id: CONV, guestEmail: EMAIL, guestUserId: "u1" }),
    ).toBe(`/messages/${CONV}`);
  });
});
