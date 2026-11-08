import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
vi.mock("@/components/message-host-form", () => ({ MessageHostButton: () => null }));
import { HostSiteFooter } from "@/components/host-site-footer";
const host = { id: "qa", slug: "qa", name: "QA Host", contactEmail: "qa@example.com", showHostedCredit: false };
describe("K1 optional host credit", () => {
 it("defaults to no platform credit and preserves host contact targets", () => {
  const html = renderToStaticMarkup(createElement(HostSiteFooter, { host: host as never }));
  expect(html).not.toContain("Hosted on");
  expect(html).not.toContain("Powered by");
  expect(html).not.toContain("/marketplace");
  expect(html).toContain("mailto:qa@example.com");
 });
 it("shows only an opted-in main-home credit", () => {
  const html = renderToStaticMarkup(createElement(HostSiteFooter, { host: { ...host, showHostedCredit: true } as never }));
  expect(html).toContain("Hosted on");
  expect(html).toContain("Yall Come Back");
  expect(html).not.toContain("/marketplace");
 });
 it("adds only a default-false column; no row updates", () => {
  const sql = readFileSync("prisma/migrations/20261108231000_host_credit_opt_in/migration.sql", "utf8");
  expect(sql.trim()).toBe('ALTER TABLE "Host" ADD COLUMN "showHostedCredit" BOOLEAN NOT NULL DEFAULT false;');
 });
});
