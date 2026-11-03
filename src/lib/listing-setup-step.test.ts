import { describe, expect, it } from "vitest";
import { resolveListingSetupStep } from "./listing-setup-step";

describe("listing setup ?step= (T36)", () => {
  it("step 1 on an existing draft goes to step 2, not the summary", () => {
    expect(resolveListingSetupStep("1")).toEqual({ redirectTo: 2 });
    expect(resolveListingSetupStep("0")).toEqual({ redirectTo: 2 });
    expect(resolveListingSetupStep("abc")).toEqual({ redirectTo: 2 });
    expect(resolveListingSetupStep("2.5")).toEqual({ redirectTo: 2 });
  });
  it("past the last step goes to publish (step 10)", () => {
    expect(resolveListingSetupStep("11")).toEqual({ redirectTo: 10 });
  });
  it("real steps and done are unchanged", () => {
    expect(resolveListingSetupStep(undefined)).toEqual({ step: 2 });
    expect(resolveListingSetupStep("")).toEqual({ step: 2 });
    for (let n = 2; n <= 10; n++) expect(resolveListingSetupStep(String(n))).toEqual({ step: n });
    expect(resolveListingSetupStep("done")).toEqual({ step: "done" });
  });
});
