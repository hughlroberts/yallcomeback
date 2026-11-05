import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("E1104-5/6 focus trap", () => {
  it("exports useFocusTrap that restores the opener and traps Tab", () => {
    const hook = src("src/lib/use-focus-trap.ts");
    expect(hook).toMatch(/export function useFocusTrap/);
    expect(hook).toMatch(/previouslyFocused/);
    expect(hook).toMatch(/e\.key !== "Tab"/);
    expect(hook).toMatch(/first\.focus\(\)|last\.focus\(\)/);
  });

  it("gallery lightbox and Message host dialog both use the shared trap", () => {
    const gallery = src("src/components/photo-gallery.tsx");
    expect(gallery).toMatch(/useFocusTrap\(/);
    const msg = src("src/components/message-host-form.tsx");
    expect(msg).toMatch(/useFocusTrap\(/);
  });
});
