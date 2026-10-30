import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isServerActionMismatch,
  saveListingWizardDraft,
  loadListingWizardDraft,
  clearListingWizardDraft,
} from "./utils";

describe("wizard helpers", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value.toString();
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(() => null),
    } as Storage;
    vi.stubGlobal("localStorage", mockStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalLocalStorage !== undefined) {
      vi.stubGlobal("localStorage", originalLocalStorage);
    }
  });

  describe("isServerActionMismatch", () => {
    it("detects Server Action not found errors", () => {
      expect(isServerActionMismatch(new Error("Server Action not found"))).toBe(
        true,
      );
      expect(
        isServerActionMismatch("Failed to find Server Action"),
      ).toBe(true);
      expect(isServerActionMismatch({ message: "409" })).toBe(false); // not string/Error
    });

    it("detects 409, 502, network/fetch errors", () => {
      expect(isServerActionMismatch(new Error("HTTP 502 Bad Gateway"))).toBe(
        true,
      );
      expect(isServerActionMismatch("409 Conflict")).toBe(true);
      expect(isServerActionMismatch(new TypeError("Failed to fetch"))).toBe(
        true,
      );
      expect(isServerActionMismatch("network error")).toBe(true);
      expect(isServerActionMismatch("random error")).toBe(false);
    });

    it("returns false for null/undefined/falsey", () => {
      expect(isServerActionMismatch(null)).toBe(false);
      expect(isServerActionMismatch(undefined)).toBe(false);
      expect(isServerActionMismatch("")).toBe(false);
    });
  });

  describe("listing wizard draft (localStorage)", () => {
    const testKey = "test-property-123";
    const testData = {
      spaceType: "entire_place",
      selected: "house",
      timestamp: 1234567890,
    };

    it("saves and loads draft", () => {
      saveListingWizardDraft(testKey, testData);
      const loaded = loadListingWizardDraft(testKey);
      expect(loaded).toEqual(testData);
    });

    it("returns null for missing draft", () => {
      const loaded = loadListingWizardDraft("nonexistent");
      expect(loaded).toBeNull();
    });

    it("clears draft", () => {
      saveListingWizardDraft(testKey, testData);
      clearListingWizardDraft(testKey);
      const loaded = loadListingWizardDraft(testKey);
      expect(loaded).toBeNull();
    });

    it("handles JSON errors gracefully", () => {
      // Simulate bad data
      localStorage.setItem(`ycb-listing-draft:${testKey}`, "invalid json");
      const loaded = loadListingWizardDraft(testKey);
      expect(loaded).toBeNull();
    });

    it("does nothing when localStorage unavailable (SSR/node)", () => {
      vi.unstubAllGlobals(); // simulate no localStorage
      saveListingWizardDraft(testKey, testData);
      const loaded = loadListingWizardDraft(testKey);
      expect(loaded).toBeNull();
      clearListingWizardDraft(testKey);
      // beforeEach will restub for next tests
    });
  });
});
