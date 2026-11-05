import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

function installWindow() {
  store.clear();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
  vi.stubGlobal("window", {
    localStorage,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("localStorage", localStorage);
}

describe("readSavedListings getSnapshot stability", () => {
  beforeEach(() => {
    installWindow();
    vi.resetModules();
  });

  it("returns the same array reference when storage is unchanged", async () => {
    const mod = await import("@/lib/saved-listings-storage");
    mod.__resetSavedListingsCacheForTests();
    const a = mod.readSavedListings();
    const b = mod.readSavedListings();
    expect(a).toBe(b);
    expect(a).toEqual([]);
  });

  it("returns a new snapshot only after a toggle write", async () => {
    const mod = await import("@/lib/saved-listings-storage");
    mod.__resetSavedListingsCacheForTests();
    const before = mod.readSavedListings();
    mod.toggleSavedListing({
      id: "p1",
      slug: "cabin",
      hostSlug: "host",
      title: "Cabin",
      city: "Austin",
      region: "TX",
      baseNightlyRate: 120,
      bedrooms: 2,
      maxGuests: 4,
      imageUrl: null,
    });
    const after = mod.readSavedListings();
    expect(after).not.toBe(before);
    expect(after).toHaveLength(1);
    expect(mod.readSavedListings()).toBe(after);
  });
});

describe("Saved stays empty state", () => {
  it("logged-out empty state offers Sign in to /login?callbackUrl=/saved", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/saved/saved-stays-client.tsx"),
      "utf8",
    );
    expect(src).toContain('href="/login?callbackUrl=/saved"');
    expect(src).toContain("Sign in");
    expect(src).toContain("isSignedIn");
    // Server page wires session → client (no client session throw).
    const page = readFileSync(
      join(process.cwd(), "src/app/saved/page.tsx"),
      "utf8",
    );
    expect(page).toContain("auth()");
    expect(page).toContain("SavedStaysClient");
    expect(page).not.toContain("useSyncExternalStore");
  });
});
