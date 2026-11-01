import { describe, expect, it } from "vitest";
import {
  clampMeta,
  hostAboutDescription,
  hostHomeDescription,
  hostSitemapEntries,
  hostStaysDescription,
} from "./host-meta";

const host = {
  name: "Cherokee Landing",
  tagline: "Private lake stays on Cedar Creek",
  description:
    "We are a family-run marina and motel on Cedar Creek Lake. ".repeat(6),
};

describe("host page meta descriptions", () => {
  it("gives home, about and stays different text", () => {
    const home = hostHomeDescription(host);
    const about = hostAboutDescription(host);
    const stays = hostStaysDescription(host);
    expect(new Set([home, about, stays]).size).toBe(3);
    expect(home).toBe(
      "Private lake stays on Cedar Creek. Book direct with Cherokee Landing.",
    );
    expect(
      about.startsWith("About Cherokee Landing: We are a family-run"),
    ).toBe(true);
    expect(stays).toContain("All stays from Cherokee Landing");
  });

  it("stays within 160 characters, cutting at a word", () => {
    for (const t of [
      hostHomeDescription({ ...host, tagline: "x ".repeat(200) }),
      hostAboutDescription(host),
      hostStaysDescription({ name: "N".repeat(300) }),
    ]) {
      expect(t.length).toBeLessThanOrEqual(160);
    }
    expect(hostAboutDescription(host).endsWith("…")).toBe(true);
    expect(clampMeta("short")).toBe("short");
  });

  it("falls back when tagline/description are empty", () => {
    const bare = { name: "Hugh", tagline: null, description: "  " };
    expect(hostHomeDescription(bare)).toBe(
      "Book direct with Hugh: see stays, prices and open dates.",
    );
    expect(hostAboutDescription(bare)).toBe(
      "About Hugh: who we are, where we host, and how to reach us.",
    );
  });
});

describe("hostSitemapEntries", () => {
  const updatedAt = new Date("2026-10-01T00:00:00Z");
  it("lists home and stays, plus About only when it is on", () => {
    const urls = (about: boolean) =>
      hostSitemapEntries("https://www.yallcomeback.app", {
        slug: "hugh-roberts",
        updatedAt,
        sitePageAbout: about,
      }).map((e) => e.url);
    expect(urls(false)).toEqual([
      "https://www.yallcomeback.app/h/hugh-roberts",
      "https://www.yallcomeback.app/h/hugh-roberts/stays",
    ]);
    expect(urls(true)).toContain(
      "https://www.yallcomeback.app/h/hugh-roberts/about",
    );
  });
});
