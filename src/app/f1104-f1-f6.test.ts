import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("F1 login required fields", () => {
  it("email and password are required; form is not noValidate", () => {
    const page = src("app/login/page.tsx");
    expect(page).not.toMatch(/noValidate/);
    expect(page).toMatch(/type="email"[\s\S]*?required/);
    expect(page).toMatch(/type="password"[\s\S]*?required/);
  });
});

describe("F4 brand home landmarks", () => {
  it("/h/[hostSlug] hero exposes header and nav landmarks", () => {
    const page = src("app/h/[hostSlug]/page.tsx");
    expect(page).toMatch(/<header\b/);
    expect(page).toMatch(/<nav\b/);
    expect(page).toMatch(/aria-label="Site"/);
  });
});

describe("F3 branded listing chrome + canonical marketplace URL", () => {
  it("middleware applies tenant for marketplace listing via=host_site", () => {
    const mw = src("middleware.ts");
    expect(mw).toMatch(/via === "host_site"/);
    expect(mw).toMatch(/\/marketplace\/properties\//);
    expect(mw).toMatch(/withTenant\(req, host/);
  });

  it("host property path still redirects to marketplace with via=host_site", () => {
    const page = src("app/h/[hostSlug]/properties/[slug]/page.tsx");
    expect(page).toMatch(/via:\s*"host_site"/);
    expect(page).toMatch(/\/marketplace\/properties\//);
  });

  it("agents.md documents marketplace canonical + via=host_site branding", () => {
    const agents = src("app/agents.md/route.ts");
    expect(agents).toMatch(/via=host_site/);
    expect(agents).toMatch(/Canonical listing URLs/);
    expect(agents).toMatch(/invalid_amenity/);
  });
});

describe("F2 personal email mailto unchanged on brand pages", () => {
  it("about and footer still mail the host contactEmail", () => {
    expect(src("app/h/[hostSlug]/about/page.tsx")).toContain(
      "mailto:${host.contactEmail}",
    );
    expect(src("components/host-site-footer.tsx")).toContain(
      "mailto:${host.contactEmail}",
    );
  });
});
