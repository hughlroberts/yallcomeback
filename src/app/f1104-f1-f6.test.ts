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

describe("K1 supersedes F3 branded redirect policy", () => {
  it("middleware sends legacy host_site bookmarks to branded documents", () => {
    const mw = src("middleware.ts");
    expect(mw).toMatch(/via === "host_site"/);
    expect(mw).toMatch(/\/marketplace\/properties\//);
    expect(mw).toContain("NextResponse.redirect(branded)");
  });

  it("host property path renders inline rather than redirecting", () => {
    const page = src("app/h/[hostSlug]/properties/[slug]/page.tsx");
    expect(page).toContain('<ListingPage');
    expect(page).not.toContain('redirect(');
  });

  it("agents.md documents separate branded and marketplace canonicals", () => {
    const agents = src("app/agents.md/route.ts");
    expect(agents).toContain('Branded listing URLs');
    expect(agents).toContain('own canonical');
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
