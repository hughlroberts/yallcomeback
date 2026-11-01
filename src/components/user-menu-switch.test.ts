import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hostModeSwitch } from "@/components/user-menu";

describe("host / guest switch", () => {
  it("offers Start hosting to guests", () => {
    expect(hostModeSwitch("/marketplace", false)).toEqual({
      href: "/for-hosts",
      label: "Start hosting",
    });
    expect(hostModeSwitch("/admin/calendar", false).label).toBe(
      "Start hosting",
    );
  });

  it("switches hosts between host tools and traveling", () => {
    expect(hostModeSwitch("/admin/calendar", true)).toEqual({
      href: "/marketplace",
      label: "Switch to traveling",
    });
    expect(hostModeSwitch("/admin", true).label).toBe("Switch to traveling");
    expect(hostModeSwitch("/marketplace/properties/x", true)).toEqual({
      href: "/admin/calendar",
      label: "Switch to hosting",
    });
    expect(hostModeSwitch("/administrator", true).label).toBe(
      "Switch to hosting",
    );
  });

  it("keeps booking links in the host menu and admin nav", () => {
    const menu = readFileSync(
      join(process.cwd(), "src/components/user-menu.tsx"),
      "utf8",
    );
    expect(menu).toContain('data-testid="mode-switch"');
    expect(menu).toContain('href="/account/bookings"');
    const nav = readFileSync(
      join(process.cwd(), "src/components/admin-nav.tsx"),
      "utf8",
    );
    expect(nav).toContain("Book a stay");
    expect(nav).toContain('href="/marketplace"');
    expect(nav).toContain('href="/account/bookings"');
  });

  it("never labels the staff link Ops", () => {
    const header = readFileSync(
      join(process.cwd(), "src/components/site-header.tsx"),
      "utf8",
    );
    expect(header).toContain('label: "Platform admin"');
    expect(header).not.toMatch(/label: "Ops/);
  });
});
