import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const src = (p: string) => readFileSync(`src/${p}`, "utf8");
describe("K1-a branded legal navigation", () => {
 it("keeps book terms/privacy and listing cancellation help branded", () => {
  const book = src("app/book/[slug]/page.tsx");
  expect(book).toContain('guestFlowPath(brandSlug, "/terms")');
  expect(book).toContain('guestFlowPath(brandSlug, "/privacy")');
  expect(src("components/things-to-know.tsx")).toContain("href={cancellationHelpHref}");
 });
 it("keeps footer legal links under its explicit host path, even on custom domains", () => {
  const footer = src("components/host-site-footer.tsx");
  expect(footer).toContain("guestFlowPath(host.slug, TERMS_PATH)");
  expect(footer).toContain("guestFlowPath(host.slug, PRIVACY_PATH)");
 });
 it("reuses global legal content and canonicals for branded aliases", () => {
  for (const page of ["terms", "privacy"]) {
   expect(src(`app/h/[hostSlug]/${page}/page.tsx`)).toContain(`@/app/${page}/page`);
   expect(src(`app/${page}/page.tsx`)).toContain(`path: "/${page}"`);
  }
 });
});
