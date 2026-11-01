import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isAnyModalOpen, openModal, subscribeModalOpen } from "./modal-open";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const zOf = (cls: string) => Number(/\bz-\[(\d+)\]/.exec(cls)?.[1] ?? NaN);

describe("modal-open store", () => {
  it("counts nested dialogs and notifies subscribers", () => {
    let calls = 0;
    const off = subscribeModalOpen(() => calls++);
    expect(isAnyModalOpen()).toBe(false);
    const closeA = openModal();
    const closeB = openModal();
    expect(isAnyModalOpen()).toBe(true);
    closeA();
    closeA(); // double close is a no-op
    expect(isAnyModalOpen()).toBe(true);
    closeB();
    expect(isAnyModalOpen()).toBe(false);
    expect(calls).toBe(4);
    off();
  });
});

describe("dialogs on listing and book pages sit above the sticky reserve bar", () => {
  const bar = read("src/components/mobile-reserve-bar.tsx");
  const barZ = zOf(/fixed inset-x-0 bottom-0 (z-\[\d+\])/.exec(bar)?.[1] ?? "");
  const headerZ = zOf(
    /<header className="sticky top-0 (z-\[\d+\])/.exec(
      read("src/components/site-header.tsx"),
    )?.[1] ?? "",
  );

  it("the bar hides itself while any dialog is open", () => {
    expect(bar).toContain("subscribeModalOpen");
    expect(bar).toMatch(/if \(!show \|\| modalOpen\) return null;/);
  });

  it.each([
    ["src/components/message-host-form.tsx", "message-host-overlay"],
    ["src/components/photo-gallery.tsx", "photo-gallery-dialog"],
  ])(
    "%s portals above the bar and header, registers as open, and pads for the iOS home bar",
    (file, testId) => {
      const src = read(file);
      expect(src).toContain("createPortal(");
      expect(src).toMatch(/useModalOpen\(/);
      const cls =
        new RegExp(`data-testid="${testId}"[\\s\\S]*?className="([^"]+)"`).exec(
          src,
        )?.[1] ?? "";
      expect(zOf(cls)).toBeGreaterThan(barZ);
      expect(zOf(cls)).toBeGreaterThan(headerZ);
      expect(src).toContain("env(safe-area-inset-bottom");
    },
  );

  it("the message dialog body scrolls within the visible viewport", () => {
    const src = read("src/components/message-host-form.tsx");
    const cls =
      /data-testid="message-host-dialog"[\s\S]*?className="([^"]+)"/.exec(
        src,
      )?.[1] ?? "";
    expect(cls).toContain("overflow-y-auto");
    expect(cls).toContain("overscroll-contain");
    expect(cls).toMatch(/max-h-\[calc\(100dvh/);
  });
});
