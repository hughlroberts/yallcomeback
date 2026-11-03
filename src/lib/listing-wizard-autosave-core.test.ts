import { describe, expect, it, vi } from "vitest";
import { createWizardAutosave } from "./listing-wizard-autosave-core";

type F = { title: string };

function fakeTimers() {
  let now = 0;
  let id = 0;
  const q = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: {
      set: (fn: () => void, ms: number) => {
        id += 1;
        q.set(id, { at: now + ms, fn });
        return id;
      },
      clear: (h: unknown) => void q.delete(h as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [k, t] of [...q]) {
        if (t.at <= now) {
          q.delete(k);
          t.fn();
        }
      }
    },
  };
}

/** A save that resolves only when the test says so (slow network). */
function slowWrite() {
  const calls: { values: F; resolve: () => void }[] = [];
  const write = vi.fn(
    (values: F) =>
      new Promise<void>((resolve) => calls.push({ values: { ...values }, resolve })),
  );
  return { write, calls };
}

const TEXT = "QA Test Listing with a long lakeside title";

describe("listing wizard autosave core", () => {
  it("fast typing with a slow save response: local text is never overwritten", async () => {
    const t = fakeTimers();
    const { write, calls } = slowWrite();
    const shown: string[] = [];
    const c = createWizardAutosave<F>({
      initial: { title: "" },
      write,
      timers: t.timers,
      debounceMs: 300,
      onChange: (v) => shown.push(v.title),
    });
    c.hydrate({ title: "" });

    // Type the first 9 characters, pause long enough for one save.
    for (const ch of TEXT.slice(0, 9)) {
      c.edit({ title: c.latest().title + ch });
      t.advance(20);
    }
    t.advance(300);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.values.title).toBe("QA Test L");

    // Keep typing fast while that save is still in flight.
    for (const ch of TEXT.slice(9)) {
      c.edit({ title: c.latest().title + ch });
      t.advance(20);
    }
    // The slow response for "QA Test L" arrives now.
    calls[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(c.latest().title).toBe(TEXT);
    expect(shown.at(-1)).toBe(TEXT);
    // No change was pushed back to the input after the response.
    expect(shown.filter((s) => s === "QA Test L")).toHaveLength(1);

    // Debounced save sends the newest text.
    t.advance(300);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.values.title).toBe(TEXT);
  });

  it("a debounced save sends only the latest value, once", () => {
    const t = fakeTimers();
    const write = vi.fn();
    const c = createWizardAutosave<F>({ initial: { title: "" }, write, timers: t.timers });
    c.hydrate({ title: "" });
    for (const ch of TEXT) c.edit({ title: c.latest().title + ch });
    expect(write).not.toHaveBeenCalled();
    t.advance(300);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith({ title: TEXT }, undefined);
  });

  it("flush (blur, step change, submit) saves exactly what was typed, now", () => {
    const t = fakeTimers();
    const write = vi.fn();
    const c = createWizardAutosave<F>({ initial: { title: "" }, write, timers: t.timers });
    c.hydrate({ title: "" });
    for (const ch of TEXT) c.edit({ title: c.latest().title + ch });
    c.flush();
    expect(write).toHaveBeenCalledWith({ title: TEXT }, undefined);
    expect(c.latest().title).toBe(TEXT);
    // Nothing left pending: the timer does not save again.
    t.advance(1000);
    expect(write).toHaveBeenCalledTimes(1);
    c.flush();
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("a late draft restore does not replace text the host already typed", () => {
    const t = fakeTimers();
    const write = vi.fn();
    const shown: string[] = [];
    const c = createWizardAutosave<F>({
      initial: { title: "" },
      write,
      timers: t.timers,
      onChange: (v) => shown.push(v.title),
    });
    for (const ch of "QA Test") c.edit({ title: c.latest().title + ch });
    // Old draft from an earlier visit arrives after typing started.
    expect(c.hydrate({ title: "old draft" })).toEqual({ title: "QA Test" });
    expect(shown).not.toContain("old draft");
    t.advance(300);
    expect(write).toHaveBeenCalledWith({ title: "QA Test" }, undefined);
  });

  it("restores the draft when the host has not typed yet", () => {
    const c = createWizardAutosave<F>({ initial: { title: "" }, write: vi.fn() });
    expect(c.hydrate({ title: "Saved earlier" })).toEqual({ title: "Saved earlier" });
    expect(c.latest().title).toBe("Saved earlier");
  });

  it("a failed save keeps the text and retries on the next flush", async () => {
    const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const c = createWizardAutosave<F>({ initial: { title: "" }, write });
    c.hydrate({ title: "" });
    c.edit({ title: TEXT });
    c.flush();
    await c.pending();
    expect(c.latest().title).toBe(TEXT);
    c.flush();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith({ title: TEXT }, undefined);
  });
});
