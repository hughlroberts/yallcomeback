/** R1104-1: the host admin top nav shows "Calendar" once. */
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/calendar" }));
import { AdminNav } from "./admin-nav";

const links = [
  { href: "/admin/calendar", label: "Calendar" },
  { href: "/admin/properties", label: "Listings" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin", label: "Dashboard", exact: true },
];

describe("AdminNav (R1104-1)", () => {
  it("host view (no label): 'Calendar' appears exactly once", () => {
    const html = renderToStaticMarkup(createElement(AdminNav, { label: null, links }));
    expect(html.match(/>Calendar</g)?.length).toBe(1);
  });
  it("platform label still renders", () => {
    const html = renderToStaticMarkup(createElement(AdminNav, { label: "Admin · brand scope", links }));
    expect(html).toContain("Admin · brand scope");
  });
});
