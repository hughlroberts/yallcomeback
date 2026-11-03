import { afterEach, describe, expect, it } from "vitest";
import {
  linkifyText,
  messageEmailHeaders,
  platformEmailHtml,
} from "@/lib/messaging";
import { canonicalSiteOrigin } from "@/lib/features";

// T20: content-side deliverability.
describe("message email headers", () => {
  it("has one-click List-Unsubscribe when a URL is given", () => {
    const h = messageEmailHeaders("https://www.yallcomeback.app/api/notifications/unsubscribe?token=x");
    expect(h["List-Unsubscribe"]).toBe(
      "<https://www.yallcomeback.app/api/notifications/unsubscribe?token=x>",
    );
    expect(h["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(h["X-Entity-Ref-ID"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("has no List-Unsubscribe without a URL", () => {
    const h = messageEmailHeaders(null);
    expect(h["List-Unsubscribe"]).toBeUndefined();
    expect(h["List-Unsubscribe-Post"]).toBeUndefined();
  });
});

describe("platform email html", () => {
  it("links each URL with the same URL as its text", () => {
    const html = linkifyText("Reset: https://www.yallcomeback.app/reset?token=a&b=1. Thanks");
    expect(html).toContain(
      '<a href="https://www.yallcomeback.app/reset?token=a&amp;b=1" style="color:#3a4a86">https://www.yallcomeback.app/reset?token=a&amp;b=1</a>.',
    );
  });

  it("escapes HTML and is a full document", () => {
    const html = platformEmailHtml("<b>hi</b>");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<meta charset="utf-8">');
  });
});

describe("link domain", () => {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  });

  it("uses www when the site URL is set to the bare domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://yallcomeback.app/";
    expect(canonicalSiteOrigin()).toBe("https://www.yallcomeback.app");
  });
});
