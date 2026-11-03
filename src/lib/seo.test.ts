import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, PRODUCT_ORIGIN } from "@/lib/features";
import {
  DEFAULT_OG_IMAGE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  homePageMetadata,
  pageMetadata,
  seoAbsoluteUrl,
  seoOrigin,
} from "@/lib/seo";

describe("seo", () => {
  it("seoOrigin is the live product origin by default", () => {
    expect(seoOrigin()).toBe(PRODUCT_ORIGIN);
  });

  it("seoAbsoluteUrl builds canonical paths", () => {
    expect(seoAbsoluteUrl("/")).toBe(`${PRODUCT_ORIGIN}/`);
    expect(seoAbsoluteUrl("/about")).toBe(`${PRODUCT_ORIGIN}/about`);
    expect(seoAbsoluteUrl("/marketplace/properties/x?host=y")).toBe(
      `${PRODUCT_ORIGIN}/marketplace/properties/x?host=y`,
    );
  });

  it("pageMetadata sets canonical, og:url, and social tags", () => {
    const meta = pageMetadata({
      title: "About",
      description: "Built by hosts.",
      path: "/about",
    });
    expect(meta.description).toBe("Built by hosts.");
    expect(meta.alternates?.canonical).toBe(`${PRODUCT_ORIGIN}/about`);
    const og = meta.openGraph as {
      url?: string;
      title?: string;
      description?: string;
      images?: { url: string }[];
    };
    expect(og.url).toBe(`${PRODUCT_ORIGIN}/about`);
    expect(og.title).toBe(`About · ${PRODUCT_NAME}`);
    expect(og.description).toBe("Built by hosts.");
    expect(og.images?.[0]?.url).toBe(DEFAULT_OG_IMAGE);
    const tw = meta.twitter as {
      card?: string;
      title?: string;
      description?: string;
      images?: string[];
    };
    expect(tw.card).toBe("summary_large_image");
    expect(tw.title).toBe(`About · ${PRODUCT_NAME}`);
    expect(tw.description).toBe("Built by hosts.");
    expect(tw.images?.[0]).toBeTruthy();
  });

  it("homePageMetadata uses absolute title and root canonical", () => {
    const meta = homePageMetadata();
    expect(meta.title).toEqual({ absolute: HOME_TITLE });
    expect(meta.description).toBe(HOME_DESCRIPTION);
    expect(meta.alternates?.canonical).toBe(`${PRODUCT_ORIGIN}/`);
    const og = meta.openGraph as { url?: string; title?: string };
    expect(og.url).toBe(`${PRODUCT_ORIGIN}/`);
    expect(og.title).toBe(HOME_TITLE);
  });

  it("T27: home title and description are a useful length, with no 'free'", () => {
    expect(HOME_TITLE.length).toBeGreaterThanOrEqual(50);
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
    expect(HOME_TITLE).toContain(PRODUCT_NAME);
    expect(HOME_DESCRIPTION.length).toBeGreaterThanOrEqual(140);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(`${HOME_TITLE} ${HOME_DESCRIPTION}`).not.toMatch(/free/i);
    expect(HOME_DESCRIPTION).toMatch(/vacation rentals directly with the host/i);
  });
});
