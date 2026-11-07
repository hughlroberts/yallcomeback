import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("T24 booking widget form fields", () => {
  it("every select has a name", () => {
    const src = read("src/components/booking-widget.tsx");
    const selects = src.match(/<select\b[^>]*>/g) ?? [];
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) expect(s).toMatch(/\b(name|id)=/);
  });
});

describe("T25 compact admin header", () => {
  it("brand bar toggle has no ops path and the exit label is Platform admin", () => {
    expect(read("src/components/admin-brand-bar-toggle.tsx")).not.toContain("/ops");
    const sw = read("src/components/admin-brand-switcher.tsx");
    expect(sw).toContain("Platform admin");
    expect(sw).not.toContain("Ops Panel");
  });
  it("admin nav wraps on phones to keep every label readable", () => {
    const nav = read("src/components/admin-nav.tsx");
    expect(nav).toContain("flex-row flex-wrap items-center");
    expect(nav).toContain('aria-label="Book a stay"');
  });
});

describe("Platform admin labels", () => {
  it("no visible Ops Panel label remains", () => {
    expect(read("src/components/ops-host-manage-chrome.tsx")).not.toContain("Ops Panel");
    expect(read("src/app/ops/layout.tsx")).not.toContain("Ops Panel");
  });
});

/** Opening tags of form fields that have no id, name or spread props. */
function fieldsWithoutIdOrName(src: string): string[] {
  const out: string[] = [];
  const re = /<(input|select|textarea|Input|Select|Textarea)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    const tag = src.slice(m.index, i);
    if (/\b(id|name)=|\{\.\.\./.test(tag) || tag.includes('type="hidden"')) continue;
    out.push(tag.slice(0, 80));
  }
  return out;
}

describe("admin form fields have an id or name", () => {
  it.each([
    "src/app/admin/brand/page.tsx",
    "src/components/listing-wizard-type-step.tsx",
    "src/components/listing-wizard-title-step.tsx",
    "src/components/listing-wizard-description-step.tsx",
    "src/components/listing-wizard-price-step.tsx",
    "src/components/listing-wizard-location-step.tsx",
    "src/components/earnings/earnings-filters.tsx",
    "src/components/admin-listing-insights.tsx",
    "src/components/admin-listing-workspace.tsx",
    "src/components/services-page-live-editor.tsx",
    "src/components/booking-widget.tsx",
  ])("%s", (file) => {
    expect(fieldsWithoutIdOrName(read(file))).toEqual([]);
  });
});

describe("Platform admin link on the phone brand row", () => {
  it("is passed as the always-visible action", () => {
    const sw = read("src/components/admin-brand-switcher.tsx");
    expect(sw).toMatch(/action=\{\s*<Link[\s\S]*?aria-label="Platform admin"/);
  });
});
