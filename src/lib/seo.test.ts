import { describe, expect, it } from "vitest";
import { PRODUCT_NAME, PRODUCT_ORIGIN } from "@/lib/features";
import {
  DEFAULT_OG_IMAGE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  homePageMetadata,
  pageMetadata,
  seoAbsoluteImageUrl,
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
      type?: string;
      images?: { url: string; width?: number; height?: number }[];
    };
    expect(og.url).toBe(`${PRODUCT_ORIGIN}/about`);
    expect(og.title).toBe(`About · ${PRODUCT_NAME}`);
    expect(og.description).toBe("Built by hosts.");
    expect(og.images?.[0]?.url).toBe(seoAbsoluteImageUrl(DEFAULT_OG_IMAGE));
    expect(og.images?.[0]?.width).toBe(1200);
    expect(og.images?.[0]?.height).toBe(630);
    expect(og.type).toBe("website");
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

  it("E1104-D6: custom images are absolute and only claim known dimensions", () => {
    const withDims = pageMetadata({
      title: "Cabin",
      description: "A stay.",
      path: "/marketplace/properties/cabin",
      type: "website",
      image: "/seed/lakefront/01.jpg",
      imageWidth: 1200,
      imageHeight: 900,
    });
    const og = withDims.openGraph as {
      type?: string;
      images?: { url: string; width?: number; height?: number }[];
    };
    expect(og.type).toBe("website");
    expect(og.images?.[0]?.url).toBe(
      seoAbsoluteImageUrl("/seed/lakefront/01.jpg"),
    );
    expect(og.images?.[0]?.width).toBe(1200);
    expect(og.images?.[0]?.height).toBe(900);

    const noDims = pageMetadata({
      title: "Cabin",
      description: "A stay.",
      path: "/marketplace/properties/cabin",
      image: "https://cdn.example/photo.jpg",
    });
    const og2 = noDims.openGraph as {
      images?: { url: string; width?: number; height?: number }[];
    };
    expect(og2.images?.[0]?.url).toBe("https://cdn.example/photo.jpg");
    expect(og2.images?.[0]?.width).toBeUndefined();
    expect(og2.images?.[0]?.height).toBeUndefined();
  });
});
