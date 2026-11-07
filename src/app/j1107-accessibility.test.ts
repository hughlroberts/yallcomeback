import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CodeBlock } from "@/components/code-block";
import { PRIMARY_CTA_FOCUS_ON_DARK_CLASS } from "@/lib/booking-cta-focus";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const src = (p: string) => readFileSync(`src/${p}`, "utf8");
describe("J1 keyboard-scrollable named code regions", () => {
 it("renders a named region in the tab order with the shared visible focus ring", () => {
  const html = renderToStaticMarkup(createElement(CodeBlock, { "aria-label": "Setup commands" }, "npm run dev"));
  expect(html).toContain('tabindex="0"');
  expect(html).toContain('role="region"');
  expect(html).toContain('aria-label="Setup commands"');
  expect(html).toContain(PRIMARY_CTA_FOCUS_ON_DARK_CLASS);
  expect(html).toContain("focus-visible:ring-inset");
  expect(html).toContain("npm run dev");
 });
 it("uses a shared focusable code block for both examples", () => {
  const page = src("app/open-source/page.tsx");
  expect(page.match(/<CodeBlock aria-label=/g)).toHaveLength(2);
  expect(page).not.toContain("<pre");
 });
});
describe("J2 explicit autofill intent", () => {
 it("sets address autocomplete tokens and disables irrelevant listing autofill", () => {
  const page = src("app/admin/properties/[id]/page.tsx");
  for (const [id, token] of Object.entries({ title: "off", tagline: "off", city: "address-level2", region: "address-level1", country: "country-name", address: "street-address" })) {
   expect(page).toMatch(new RegExp(`<Input id="${id}"[^>]*autoComplete="${token}"`));
  }
 });
 it("sets invite email and new-password tokens", () => {
  const team = src("app/admin/team/page.tsx");
  expect(team).toMatch(/id="email"[^>]*autoComplete="email"/);
  expect(team).toMatch(/id="password"[^>]*autoComplete="new-password"/);
 });
});

describe("J2 reopened invite autocomplete coverage", () => {
 it("gives every invite field an explicit appropriate autocomplete token", () => {
  const team = src("app/admin/team/page.tsx");
  const form = team.slice(team.indexOf("<form action={inviteCoHost}"), team.indexOf("</form>", team.indexOf("<form action={inviteCoHost}")));
  const fields = form.match(/<(?:Input|input|select|textarea)\b[^>]*>/g) ?? [];
  expect(fields).toHaveLength(4);
  for (const field of fields) expect(field).toMatch(/autoComplete="[^"]+"/);
  expect(form).toMatch(/id="name"[^>]*autoComplete="name"/);
  expect(form).toMatch(/id="hostAccess"[^>]*autoComplete="off"/);
 });
});
