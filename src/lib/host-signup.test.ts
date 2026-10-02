import { describe, expect, it } from "vitest";
import {
  hostRecordName,
  signupNeedsBrandFields,
} from "@/lib/host-signup";

describe("signupNeedsBrandFields", () => {
  it("skips brand fields for marketplace-only paid hosting", () => {
    expect(
      signupNeedsBrandFields({
        hostingMode: "PLATFORM",
        sitePresence: "STAYLOCAL",
      }),
    ).toBe(false);
  });

  it("asks for brand fields on a branded website or self-host", () => {
    expect(
      signupNeedsBrandFields({
        hostingMode: "PLATFORM",
        sitePresence: "BOTH",
      }),
    ).toBe(true);
    expect(
      signupNeedsBrandFields({
        hostingMode: "SELF",
        sitePresence: "CUSTOM",
      }),
    ).toBe(true);
  });
});

describe("hostRecordName", () => {
  it("uses the person's name for marketplace when no brand is given", () => {
    expect(
      hostRecordName({
        personalName: "Hugh Roberts",
        brandName: "",
        needsBrand: false,
      }),
    ).toBe("Hugh Roberts");
  });

  it("requires the brand name for a website", () => {
    expect(
      hostRecordName({
        personalName: "Hugh Roberts",
        brandName: "Lakeside Cabins",
        needsBrand: true,
      }),
    ).toBe("Lakeside Cabins");
    expect(
      hostRecordName({
        personalName: "Hugh Roberts",
        brandName: "  ",
        needsBrand: true,
      }),
    ).toBe("");
  });
});
