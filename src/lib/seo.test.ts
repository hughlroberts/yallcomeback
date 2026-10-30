import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, PRODUCT_ORIGIN, PRODUCT_TAGLINE } from "@/lib/features";
import {
  DEFAULT_OG_IMAGE,
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
    expect(meta.title).toEqual({ absolute: PRODUCT_NAME });
    expect(meta.description).toBe(PRODUCT_TAGLINE);
    expect(meta.alternates?.canonical).toBe(`${PRODUCT_ORIGIN}/`);
    const og = meta.openGraph as { url?: string; title?: string };
    expect(og.url).toBe(`${PRODUCT_ORIGIN}/`);
    expect(og.title).toBe(PRODUCT_NAME);
  });
});
