import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkFormStamp,
  honeypotTripped,
  issueFormStamp,
  turnstileEnabled,
  turnstileSiteKey,
  verifyTurnstile,
} from "./human-checks";

const ENV = { ...process.env };

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-human-checks";
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_HOSTNAMES;
});
afterEach(() => {
  process.env = { ...ENV };
});

describe("form stamp (minimum fill time)", () => {
  const t0 = 1_800_000_000_000;
  it("accepts a form filled in a human amount of time", () => {
    expect(checkFormStamp(issueFormStamp(t0), t0 + 10_000)).toEqual({
      ok: true,
    });
  });
  it("rejects instant submits, stale forms, tampering and missing stamps", () => {
    const s = issueFormStamp(t0);
    expect(checkFormStamp(s, t0 + 500)).toEqual({
      ok: false,
      reason: "too_fast",
    });
    expect(checkFormStamp(s, t0 + 25 * 3600_000)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(checkFormStamp(`${t0 - 60_000}.${s.split(".")[1]}`, t0)).toEqual({
      ok: false,
      reason: "bad",
    });
    expect(checkFormStamp("", t0)).toEqual({ ok: false, reason: "missing" });
    expect(checkFormStamp("garbage", t0)).toEqual({ ok: false, reason: "bad" });
  });
});

describe("honeypot", () => {
  it("trips only when the hidden field has text", () => {
    expect(honeypotTripped(null)).toBe(false);
    expect(honeypotTripped("  ")).toBe(false);
    expect(honeypotTripped("http://spam.example")).toBe(true);
  });
});

describe("Turnstile (optional)", () => {
  it("is off and skipped unless both keys are set", async () => {
    expect(turnstileEnabled()).toBe(false);
    expect(turnstileSiteKey()).toBeNull();
    process.env.TURNSTILE_SITE_KEY = "site";
    expect(turnstileEnabled()).toBe(false);
    const f = vi.fn();
    expect(await verifyTurnstile(null, "1.2.3.4", f)).toEqual({
      ok: true,
      skipped: true,
    });
    expect(f).not.toHaveBeenCalled();
  });

  describe("when configured", () => {
    beforeEach(() => {
      process.env.TURNSTILE_SITE_KEY = "site-key";
      process.env.TURNSTILE_SECRET_KEY = "secret-key";
    });
    const reply = (body: object, ok = true) =>
      vi.fn(async () => ({ ok, json: async () => body }) as Response);

    it("requires a token", async () => {
      expect(await verifyTurnstile("", "1.2.3.4", reply({}))).toEqual({
        ok: false,
        reason: "missing",
      });
    });
    it("passes a valid token for the inquiry action", async () => {
      const f = reply({ success: true, action: "inquiry", hostname: "x" });
      expect(await verifyTurnstile("tok", "1.2.3.4", f)).toEqual({
        ok: true,
        skipped: false,
      });
      const body = (f.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as URLSearchParams;
      expect(body.get("response")).toBe("tok");
      expect(body.get("remoteip")).toBe("1.2.3.4");
    });
    it("fails closed on errors, failures, wrong action or hostname", async () => {
      expect(
        await verifyTurnstile(
          "tok",
          "ip",
          vi.fn(async () => {
            throw new Error("down");
          }),
        ),
      ).toEqual({ ok: false, reason: "unavailable" });
      expect(await verifyTurnstile("tok", "ip", reply({}, false))).toEqual({
        ok: false,
        reason: "unavailable",
      });
      expect(
        await verifyTurnstile("tok", "ip", reply({ success: false })),
      ).toEqual({
        ok: false,
        reason: "failed",
      });
      expect(
        await verifyTurnstile(
          "tok",
          "ip",
          reply({ success: true, action: "login" }),
        ),
      ).toEqual({ ok: false, reason: "action" });
      process.env.TURNSTILE_HOSTNAMES = "www.yallcomeback.app";
      expect(
        await verifyTurnstile(
          "tok",
          "ip",
          reply({ success: true, action: "inquiry", hostname: "evil.example" }),
        ),
      ).toEqual({ ok: false, reason: "hostname" });
    });
  });
});
