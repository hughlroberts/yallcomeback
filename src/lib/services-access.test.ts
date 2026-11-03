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

describe("services access", () => {
  it("paid-plan gate: marketplace-only without override cannot use Services", () => {
    expect(hostCanUseServices(marketplace)).toBe(false);
    expect(hostCanUseServices({ ...marketplace, servicesOverride: false })).toBe(false);
    expect(hostServicesPageOn({ ...marketplace, sitePageServices: true })).toBe(false);
  });

  it("branded website or self-host can", () => {
    expect(hostCanUseServices(branded)).toBe(true);
    expect(hostCanUseServices(selfHost)).toBe(true);
  });

  it("override lets a marketplace-only brand use Services", () => {
    const h = { ...marketplace, servicesOverride: true };
    expect(hostCanUseServices(h)).toBe(true);
    expect(hostServicesPageOn({ ...h, sitePageServices: true })).toBe(true);
    expect(hostServicesPageOn({ ...h, sitePageServices: false })).toBe(false);
  });

  it("header nav shows the Services link only when allowed", () => {
    expect(nav(marketplace)).not.toContain("Boats");
    expect(nav({ ...marketplace, servicesOverride: true })).toContain("Boats");
    expect(nav(branded)).toContain("Boats");
  });
});
