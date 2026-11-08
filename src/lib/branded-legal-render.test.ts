import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/host", () => ({ getHostForGuestSite: async () => ({ slug: "qa-host" }) }));
vi.mock("@/lib/auth", () => ({ auth: async () => null }));
import TermsPage, { metadata as termsMetadata } from "@/app/terms/page";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/privacy/page";
import { HelpArticleBody } from "@/components/help/help-articles";
import { getHelpArticle } from "@/lib/help";

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
describe("K1-a same shared content, branded navigation", () => {
 for (const [name, Page, metadata] of [["terms", TermsPage, termsMetadata], ["privacy", PrivacyPage, privacyMetadata]] as const) {
  it(`${name}: unchanged legal content and global canonical, branded cross-links`, async () => {
   const globalHtml = renderToStaticMarkup(await Page());
   const brandedHtml = renderToStaticMarkup(await Page({ params: Promise.resolve({ hostSlug: "qa-host" }) }));
   expect(brandedHtml.replace(/href="[^"]*"/g, 'href="ROUTE"')).toBe(globalHtml.replace(/href="[^"]*"/g, 'href="ROUTE"'));
   expect(hrefs(brandedHtml).filter((h) => h.startsWith("/"))).toEqual(expect.arrayContaining(["/h/qa-host/terms", "/h/qa-host/privacy", "/h/qa-host/contact"]));
   expect(hrefs(brandedHtml).filter((h) => h.startsWith("/")).every((h) => h.startsWith("/h/qa-host/"))).toBe(true);
   expect(metadata.alternates?.canonical).toBe(`https://www.yallcomeback.app/${name}`);
  });
 }
 it("cancellation policy body is shared; branded navigation contains no marketplace or global help escape", () => {
  const article = getHelpArticle("cancellation-policies")!;
  const globalHtml = renderToStaticMarkup(createElement(HelpArticleBody, { article }));
  const brandedHtml = renderToStaticMarkup(createElement(HelpArticleBody, { article, hostSlug: "qa-host" }));
  const body = (html: string) => html.split('<article class="mx-auto max-w-3xl px-4 py-10 sm:px-6">')[1].split('<section class="mt-12')[0];
  expect(body(brandedHtml)).toBe(body(globalHtml));
  expect(hrefs(brandedHtml).every((h) => h.startsWith("/h/qa-host/"))).toBe(true);
  expect(brandedHtml).not.toContain("/marketplace");
  expect(globalHtml).toContain('/marketplace');
 });
});
