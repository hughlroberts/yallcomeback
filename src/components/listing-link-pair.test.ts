import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ListingLinkPair } from "./listing-link-pair";

describe("ListingLinkPair (R1104-6)", () => {
  it("keeps '(Open here)' on one line", () => {
    const html = renderToStaticMarkup(
      createElement(ListingLinkPair, { href: "/x", testId: "t", children: "X" }),
    );
    expect(html).toMatch(/class="whitespace-nowrap[^"]*"[^>]*data-testid="t-here"/);
  });
});
