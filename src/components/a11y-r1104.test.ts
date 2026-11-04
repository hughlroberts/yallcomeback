import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (p: { alt: string }) => createElement("img", { alt: p.alt }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { PhotoGallery } from "./photo-gallery";

describe("R1104-16 gallery button name contains its visible text", () => {
  it("'+N more' button", () => {
    const photos = Array.from({ length: 16 }, (_, i) => ({
      id: `p${i}`,
      url: `/i${i}.jpg`,
      alt: null,
    }));
    const html = renderToStaticMarkup(
      createElement(PhotoGallery, { photos, title: "Cabin" }),
    );
    const m = html.match(/aria-label="([^"]*view all 16 photos)"/);
    expect(m).toBeTruthy();
    expect(m![1]).toContain("+11 more");
    expect(html).toContain("+11 more</span>");
  });
});

describe("R1104-17 landmarks and heading order", () => {
  const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  it("header and footer navs are labelled", () => {
    expect(src("components/site-header-nav.tsx")).toMatch(/<nav aria-label="Main"/);
    expect(src("components/site-footer.tsx")).toMatch(/<nav aria-label="Footer"/);
  });
  it("marketplace has an h2 before the h3 card titles", () => {
    expect(src("app/marketplace/page.tsx")).toMatch(/<h2 className="sr-only">Stays<\/h2>/);
  });
});
