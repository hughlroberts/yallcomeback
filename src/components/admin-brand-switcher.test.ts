import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/actions/admin-brand", () => ({ switchAdminBrand: vi.fn() }));

import { AdminBrandSwitcher } from "./admin-brand-switcher";

const hosts = [
  { id: "h1", name: "Hugh Roberts", slug: "hugh-roberts" },
  { id: "h2", name: "Cherokee Landing", slug: "cherokee-landing" },
];

describe("brand switcher: Change brand", () => {
  it("brand picked: shows Change brand, which clears the brand and goes to the picker", () => {
    const html = renderToStaticMarkup(
      createElement(AdminBrandSwitcher, {
        hosts,
        activeHostId: "h1",
        returnTo: "/admin/messages",
      }),
    );
    expect(html).toContain("Change brand");
    // The clear form sends an empty brand and returns to /admin (the picker)
    expect(html).toMatch(/<input type="hidden" name="hostId" value=""\/><input type="hidden" name="returnTo" value="\/admin"\/>/);
  });

  it("no brand picked: no Change brand button", () => {
    const html = renderToStaticMarkup(
      createElement(AdminBrandSwitcher, { hosts, activeHostId: null }),
    );
    expect(html).not.toContain("Change brand");
  });
});
