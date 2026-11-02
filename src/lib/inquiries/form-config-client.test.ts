import { afterEach, describe, expect, it, vi } from "vitest";
import { MIN_FILL_MS, STAMP_FIELD } from "./fields";
import {
  FORM_CONFIG_PATH,
  FORM_CONFIG_UNREACHABLE,
  fetchInquiryFormConfig,
  msUntilFillAllowed,
  prepareInquirySubmit,
  type InquiryFormConfig,
} from "./form-config-client";

const okFetch = (body: unknown) =>
  vi.fn(async () => ({ ok: true, json: async () => body }));

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchInquiryFormConfig", () => {
  it("returns the stamp and site key, stamped with the receive time", async () => {
    const fetchImpl = okFetch({ stamp: "123.abc", turnstileSiteKey: "k" });
    const c = await fetchInquiryFormConfig({ fetchImpl, now: () => 42 });
    expect(c).toEqual({
      stamp: "123.abc",
      turnstileSiteKey: "k",
      receivedAt: 42,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      FORM_CONFIG_PATH,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("treats a missing site key as no Turnstile", async () => {
    const c = await fetchInquiryFormConfig({
      fetchImpl: okFetch({ stamp: "1.a", turnstileSiteKey: null }),
    });
    expect(c?.turnstileSiteKey).toBeNull();
  });

  it("returns null on 502, network error, bad JSON or empty stamp", async () => {
    const bad = [
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("bad");
        },
      })),
      okFetch({ stamp: "" }),
      okFetch(null),
    ];
    for (const fetchImpl of bad) {
      expect(await fetchInquiryFormConfig({ fetchImpl })).toBeNull();
    }
  });

  it("gives up (null) and aborts when the request never answers", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn(
      (_: string, init?: { signal?: AbortSignal }) =>
        new Promise<never>(() => {
          signal = init?.signal;
        }),
    );
    const p = fetchInquiryFormConfig({ fetchImpl, timeoutMs: 5_000 });
    await vi.advanceTimersByTimeAsync(4_999);
    let settled = false;
    void p.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBeNull();
    expect(signal?.aborted).toBe(true);
  });
});

describe("prepareInquirySubmit", () => {
  const cfg = (receivedAt: number): InquiryFormConfig => ({
    stamp: "999.sig",
    turnstileSiteKey: null,
    receivedAt,
  });

  it("does nothing when the form already has a stamp", async () => {
    const fd = new FormData();
    fd.set(STAMP_FIELD, "1.a");
    const ensureConfig = vi.fn();
    expect(await prepareInquirySubmit(fd, { ensureConfig })).toEqual({
      ok: true,
    });
    expect(ensureConfig).not.toHaveBeenCalled();
  });

  it("fetches a stamp when missing and waits out the fill-time minimum", async () => {
    const fd = new FormData();
    fd.set(STAMP_FIELD, "");
    const sleep = vi.fn(async () => {});
    const r = await prepareInquirySubmit(fd, {
      ensureConfig: async () => cfg(10_000),
      sleep,
      now: () => 10_000,
    });
    expect(r).toEqual({ ok: true });
    expect(fd.get(STAMP_FIELD)).toBe("999.sig");
    expect(sleep).toHaveBeenCalledWith(MIN_FILL_MS + 250);
  });

  it("doesn't wait when the stamp is already old enough", async () => {
    const fd = new FormData();
    const sleep = vi.fn(async () => {});
    await prepareInquirySubmit(fd, {
      ensureConfig: async () => cfg(0),
      sleep,
      now: () => 60_000,
    });
    expect(sleep).not.toHaveBeenCalled();
    expect(fd.get(STAMP_FIELD)).toBe("999.sig");
  });

  it("returns a friendly error (no send) when no stamp can be had", async () => {
    const fd = new FormData();
    expect(
      await prepareInquirySubmit(fd, { ensureConfig: async () => null }),
    ).toEqual({ ok: false, error: FORM_CONFIG_UNREACHABLE });
    expect(fd.get(STAMP_FIELD)).toBeNull();
  });
});

describe("msUntilFillAllowed", () => {
  it("counts down from MIN_FILL_MS + 250ms", () => {
    expect(msUntilFillAllowed(1000, 1000)).toBe(MIN_FILL_MS + 250);
    expect(msUntilFillAllowed(1000, 1000 + MIN_FILL_MS + 250)).toBe(0);
    expect(msUntilFillAllowed(0, 99_999)).toBe(0);
  });
});
