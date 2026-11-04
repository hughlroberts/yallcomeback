import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NotFound, { metadata } from "./not-found";

describe("site not-found page", () => {
  const html = renderToStaticMarkup(createElement(NotFound));

  it("links home and to the marketplace", () => {
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/marketplace"');
    expect(html).toContain("Browse stays");
    expect(html).toContain("Back home");
  });

  it("uses the site brand: seal, display heading, bonnet button", () => {
    expect(html).toContain("/brand/ycb-seal.svg");
    expect(html).toMatch(/<h1[^>]*font-display[^>]*>/);
    expect(html).toContain("bg-bonnet");
    expect(html).toContain("404");
  });

  it("is titled and kept out of search results", () => {
    expect((metadata.title as { absolute: string }).absolute).toMatch(/^Page not found · /);
    expect(metadata.robots).toEqual({ index: false });
  });
});
