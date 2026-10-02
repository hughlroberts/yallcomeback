import { afterEach, describe, expect, it } from "vitest";
import {
  canUseListingImportAgent,
  isAgentApiEnabled,
  isListingImportAgentEnabled,
  isPlatformProductMode,
} from "@/lib/platform-features";

const KEYS = [
  "YCB_OPEN_SOURCE_BUILD",
  "PLATFORM_PRODUCT_MODE",
  "AGENT_API_ENABLED",
  "LISTING_IMPORT_AGENT_ENABLED",
] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("platform agent gates", () => {
  it("defaults off for a self-host copy", () => {
    expect(isPlatformProductMode()).toBe(false);
    expect(isAgentApiEnabled()).toBe(false);
    expect(isListingImportAgentEnabled()).toBe(false);
    expect(canUseListingImportAgent({ hostingMode: "PLATFORM" })).toBe(false);
  });

  it("turns on with PLATFORM_PRODUCT_MODE for the hosted product", () => {
    process.env.PLATFORM_PRODUCT_MODE = "true";
    expect(isAgentApiEnabled()).toBe(true);
    expect(isListingImportAgentEnabled()).toBe(true);
    expect(canUseListingImportAgent({ hostingMode: "PLATFORM" })).toBe(true);
    expect(canUseListingImportAgent({ hostingMode: "SELF" })).toBe(false);
  });

  it("YCB_OPEN_SOURCE_BUILD forces agent features off", () => {
    process.env.PLATFORM_PRODUCT_MODE = "true";
    process.env.YCB_OPEN_SOURCE_BUILD = "true";
    expect(isAgentApiEnabled()).toBe(false);
    expect(isListingImportAgentEnabled()).toBe(false);
  });
});
