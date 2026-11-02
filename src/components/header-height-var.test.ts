import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeaderHeightVar } from "./header-height-var";
import { SITE_HEADER_HEIGHT_VAR } from "@/lib/sticky-offset";

describe("HeaderHeightVar", () => {
  it("renders only a hidden marker on the server", () => {
    expect(renderToStaticMarkup(createElement(HeaderHeightVar))).toBe(
      '<span hidden="" aria-hidden="true"></span>',
    );
  });

  it("uses the variable name the sticky classes read", () => {
    expect(SITE_HEADER_HEIGHT_VAR).toBe("--site-header-h");
  });
});
