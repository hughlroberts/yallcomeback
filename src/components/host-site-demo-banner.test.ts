import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HostSiteDemoBanner } from "./host-site-demo-banner";

const base = {
  id: "h1",
  name: "QA Test",
  slug: "qa-test",
  sitePublishState: "UNPUBLISHED" as const,
  websiteUrl: null,
  sitePageAbout: false,
  sitePageServices: false,
  siteServicesPath: null,
  hostingMode: "PLATFORM" as const,
};

function bar(sitePresence: "STAYLOCAL" | "BOTH", publish: "UNPUBLISHED" | "LIVE" | "DEMO" = "UNPUBLISHED") {
  return renderToStaticMarkup(
    createElement(HostSiteDemoBanner, {
      host: { ...base, sitePresence, sitePublishState: publish },
      isOwnerPreview: true,
      isPlatformAdmin: true,
    }),
  );
}

describe("admin preview bar Services link (T41)", () => {
  it.each(["UNPUBLISHED", "LIVE", "DEMO"] as const)(
    "marketplace-only brand: no Add Other services page link (%s)",
    (state) => {
      const html = bar("STAYLOCAL", state);
      expect(html).not.toContain("Add Other services page");
      expect(html).not.toContain("Edit Services page");
    },
  );

  it("Branded website brand still gets the Add link", () => {
    expect(bar("BOTH")).toContain("Add Other services page");
  });
});
