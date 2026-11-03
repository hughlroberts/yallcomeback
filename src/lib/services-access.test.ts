import { describe, expect, it } from "vitest";
import { hostCanUseServices, hostServicesPageOn } from "./services-access";
import { hostSiteNavItems } from "./host-site";

const marketplace = { hostingMode: "PLATFORM", sitePresence: "STAYLOCAL" } as const;
const branded = { hostingMode: "PLATFORM", sitePresence: "BOTH" } as const;
const selfHost = { hostingMode: "SELF", sitePresence: "STAYLOCAL" } as const;

function nav(h: object) {
  return hostSiteNavItems({
    sitePageAbout: false,
    sitePageServices: true,
    siteServicesTitle: "Boats",
    siteServicesPath: "boats",
    ...(h as typeof marketplace),
  }).map((i) => i.label);
}

describe("services access (Branded plan only)", () => {
  it("marketplace-only cannot use Services; the deprecated override flag is ignored", () => {
    expect(hostCanUseServices(marketplace)).toBe(false);
    const leftover = { ...marketplace, servicesOverride: true } as typeof marketplace;
    expect(hostCanUseServices(leftover)).toBe(false);
    expect(hostServicesPageOn({ ...leftover, sitePageServices: true })).toBe(false);
  });

  it("branded website (incl. a marketplace brand that upgraded) or self-host can", () => {
    expect(hostCanUseServices(branded)).toBe(true);
    expect(hostCanUseServices(selfHost)).toBe(true);
    expect(hostServicesPageOn({ ...branded, sitePageServices: true })).toBe(true);
    expect(hostServicesPageOn({ ...branded, sitePageServices: false })).toBe(false);
  });

  it("header nav hides the Services link for marketplace-only brands", () => {
    expect(nav(marketplace)).not.toContain("Boats");
    expect(nav({ ...marketplace, servicesOverride: true })).not.toContain("Boats");
    expect(nav(branded)).toContain("Boats");
  });
});
