import { describe, expect, it } from "vitest";
import {
  forHostsServiceJsonLd,
  helpFaqJsonLd,
  hostOrganizationJsonLd,
  jsonLdScriptBody,
} from "@/lib/json-ld";
import { HELP_ARTICLES, helpPath } from "@/lib/help";
import { BRANDED_WEBSITE_USD, MARKETPLACE_LISTING_USD } from "@/lib/hosting-prices";

const origin = "https://www.yallcomeback.app";

describe("jsonLdScriptBody", () => {
  it("cannot close the script tag and still parses", () => {
    const body = jsonLdScriptBody({ name: "</script><script>alert(1)</script> & co" });
    expect(body).not.toContain("</script");
    expect(JSON.parse(body).name).toBe("</script><script>alert(1)</script> & co");
  });
});

describe("forHostsServiceJsonLd", () => {
  it("is a Service with the published prices", () => {
    const d = forHostsServiceJsonLd({ origin, url: `${origin}/for-hosts`, description: "x" });
    expect(d["@type"]).toBe("Service");
    const prices = (d.offers as { name: string; price: number }[]).map((o) => [o.name, o.price]);
    expect(prices).toEqual([
      ["Marketplace listing", MARKETPLACE_LISTING_USD],
      ["Branded website", BRANDED_WEBSITE_USD],
      ["Self-host", 0],
    ]);
    expect(JSON.stringify(d)).not.toMatch(/aggregateRating|review/i);
    // The marketplace is never called free.
    const market = (d.offers as { name: string; description: string }[])[0]!;
    expect(market.description).not.toMatch(/free/i);
  });
});

describe("helpFaqJsonLd", () => {
  it("has one Question per real help article", () => {
    const d = helpFaqJsonLd({ articles: HELP_ARTICLES, urlFor: (s) => `${origin}${helpPath(s)}` });
    const q = d.mainEntity as { "@type": string; name: string; acceptedAnswer: { text: string } }[];
    expect(d["@type"]).toBe("FAQPage");
    expect(q).toHaveLength(HELP_ARTICLES.length);
    expect(q[0]!.name).toBe(HELP_ARTICLES[0]!.title);
    expect(q[0]!.acceptedAnswer.text).toBe(HELP_ARTICLES[0]!.body);
  });
});

describe("hostOrganizationJsonLd", () => {
  it("uses only real host fields and no ratings", () => {
    const d = hostOrganizationJsonLd({
      origin,
      url: `${origin}/h/cherokee-landing`,
      host: { name: "Cherokee Landing", logoUrl: "/brand/hosts/cl.png", contactPhone: "", tagline: null },
      sameAs: ["https://www.facebook.com/cl"],
    });
    expect(d).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Cherokee Landing",
      url: `${origin}/h/cherokee-landing`,
      logo: `${origin}/brand/hosts/cl.png`,
      sameAs: ["https://www.facebook.com/cl"],
    });
  });
});
