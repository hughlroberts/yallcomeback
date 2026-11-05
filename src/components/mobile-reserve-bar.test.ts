import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("MobileReserveBar focus / inert (N2)", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/mobile-reserve-bar.tsx"),
    "utf8",
  );
  const page = readFileSync(
    join(process.cwd(), "src/app/marketplace/properties/[slug]/page.tsx"),
    "utf8",
  );
  const focusHelper = readFileSync(
    join(process.cwd(), "src/lib/booking-cta-focus.ts"),
    "utf8",
  );

  it("stays mounted when hidden: inert + hidden, no early return null", () => {
    expect(src).toContain("inert={!visible}");
    expect(src).toContain("aria-hidden={visible ? undefined : true}");
    expect(src).toContain("focusInlineReserveCta");
    expect(src).toContain('data-visible={visible ? "true" : "false"}');
    expect(src).not.toMatch(
      /if\s*\(\s*!show\s*\|\|\s*modalOpen\s*\)\s*return\s+null/,
    );
    expect(src).toMatch(/visible\s*\?\s*"fixed[\s\S]*:\s*"hidden lg:hidden"/);
  });

  it("listing page renders the bar before #reserve / BookingWidget (tab order)", () => {
    const barAt = page.indexOf("<MobileReserveBar");
    const widgetAt = page.indexOf("<BookingWidget");
    expect(barAt).toBeGreaterThan(0);
    expect(widgetAt).toBeGreaterThan(0);
    expect(barAt).toBeLessThan(widgetAt);
  });

  it("moves focus to the inline CTA before hiding", () => {
    expect(src).toContain("root.contains(document.activeElement)");
    expect(src).toContain("focusInlineReserveCta(targetId)");
    expect(src).toContain("setShow(false)");
  });

  it("focusInlineReserveCta prefers the booking-card-footer button", () => {
    expect(focusHelper).toContain("focusInlineReserveCta");
    expect(focusHelper).toContain("booking-card-footer");
    expect(focusHelper).toContain("Request to book|Reserve");
  });
});
