import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOOKING_CTA_FOCUS_CLASS,
  PRIMARY_CTA_FOCUS_CLASS,
  PRIMARY_CTA_FOCUS_ON_DARK_CLASS,
  PRIMARY_CTA_FOCUS_ON_CYAN_950_CLASS,
  PRIMARY_CTA_FOCUS_ON_SLATE_900_CLASS,
  BOOKING_CTA_FOCUS_CONTRAST,
  PRIMARY_CTA_FOCUS_ON_DARK_CONTRAST,
  PRIMARY_CTA_FOCUS_ON_CYAN_950_CONTRAST,
  PRIMARY_CTA_FOCUS_ON_SLATE_900_CONTRAST,
} from "@/lib/booking-cta-focus";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (name.endsWith(".tsx") && !name.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

/** Opening tag text for button / Link / a (no nested tags). */
function interactiveOpenTags(src: string): string[] {
  const out: string[] = [];
  const startRe = /<(button|Link|a)\b/g;
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(src))) {
    const start = m.index;
    let i = start + m[0].length;
    let quote: string | null = null;
    while (i < src.length) {
      const ch = src[i];
      if (quote) {
        if (ch === quote) quote = null;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
        i++;
        continue;
      }
      if (ch === ">") {
        out.push(src.slice(start, i + 1));
        break;
      }
      i++;
      if (i - start > 2500) break;
    }
  }
  return out;
}

describe("PRIMARY_CTA_FOCUS shared tokens", () => {
  it("light alias matches booking CTA class", () => {
    expect(PRIMARY_CTA_FOCUS_CLASS).toBe(BOOKING_CTA_FOCUS_CLASS);
    expect(PRIMARY_CTA_FOCUS_CLASS).toContain("ring-[#171717]");
    expect(PRIMARY_CTA_FOCUS_CLASS).toContain("ring-offset-buttermilk");
    expect(BOOKING_CTA_FOCUS_CONTRAST.offsetVsButton).toBeGreaterThanOrEqual(3);
    expect(BOOKING_CTA_FOCUS_CONTRAST.ringVsOffset).toBeGreaterThanOrEqual(3);
  });

  it("dark variant uses buttermilk ring + stone-950 offset (≥3:1)", () => {
    expect(PRIMARY_CTA_FOCUS_ON_DARK_CLASS).toContain("ring-buttermilk");
    expect(PRIMARY_CTA_FOCUS_ON_DARK_CLASS).toContain("ring-offset-stone-950");
    expect(PRIMARY_CTA_FOCUS_ON_DARK_CONTRAST.offsetVsHoney).toBeGreaterThanOrEqual(3);
    expect(PRIMARY_CTA_FOCUS_ON_DARK_CONTRAST.ringVsOffset).toBeGreaterThanOrEqual(3);
  });

  it("section-matched dark offsets stay ≥3:1", () => {
    expect(PRIMARY_CTA_FOCUS_ON_CYAN_950_CLASS).toContain("ring-offset-cyan-950");
    expect(PRIMARY_CTA_FOCUS_ON_SLATE_900_CLASS).toContain("ring-offset-slate-900");
    expect(PRIMARY_CTA_FOCUS_ON_CYAN_950_CONTRAST.offsetVsWhite).toBeGreaterThanOrEqual(3);
    expect(PRIMARY_CTA_FOCUS_ON_SLATE_900_CONTRAST.offsetVsWhite).toBeGreaterThanOrEqual(3);
  });

  it("known public CTAs use the shared helper (not outline-bonnet)", () => {
    const stay = readFileSync(
      join(process.cwd(), "src/components/stay-search-form.tsx"),
      "utf8",
    );
    expect(stay).toContain("PRIMARY_CTA_FOCUS_CLASS");
    expect(stay).toMatch(/type="submit"[\s\S]*?PRIMARY_CTA_FOCUS_CLASS/);

    const hosts = readFileSync(
      join(process.cwd(), "src/app/for-hosts/page.tsx"),
      "utf8",
    );
    const startIdx = hosts.indexOf(">\n              Start hosting");
    const alt = hosts.indexOf("Start hosting");
    const idx = startIdx >= 0 ? startIdx : alt;
    const window = hosts.slice(Math.max(0, idx - 280), idx);
    expect(window).toContain("PRIMARY_CTA_FOCUS_ON_DARK_CLASS");

    const home = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(home).toContain("PRIMARY_CTA_FOCUS_CLASS");
    expect(home).toContain("Find a stay");
    const homeStart = home.indexOf("Start hosting");
    expect(home.slice(Math.max(0, homeStart - 220), homeStart)).toContain(
      "PRIMARY_CTA_FOCUS_ON_CYAN_950_CLASS",
    );

    const ui = readFileSync(join(process.cwd(), "src/components/ui.tsx"), "utf8");
    expect(ui).toContain("BOOKING_CTA_FOCUS_CLASS");
  });

  it("interactive solid bg-bonnet CTAs include a shared focus helper", () => {
    const files = walk(join(process.cwd(), "src"));
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const tag of interactiveOpenTags(src)) {
        // Solid fill (not /opacity tint) with padding → primary-looking control
        if (!/\bbg-bonnet\b/.test(tag)) continue;
        if (/\bbg-bonnet\//.test(tag) && !/\bbg-bonnet\s/.test(tag) && !/\bbg-bonnet`/.test(tag) && !/bg-bonnet px-/.test(tag) && !/bg-bonnet text-/.test(tag)) {
          // only tinted variants like bg-bonnet/90 as hover are ok; require bare bg-bonnet
        }
        if (!/\bbg-bonnet(?:\s|`|"|'|\$)/.test(tag) && !/bg-bonnet px-/.test(tag) && !/bg-bonnet text-/.test(tag)) {
          continue;
        }
        // Ignore ternaries that only paint active tabs: "? \"bg-bonnet" without px on same branch is still caught if px is on outer
        if (!/\bpx-\d/.test(tag)) continue;
        // Badge-like tiny pills without hover: still CTAs if button — keep requiring focus
        if (
          tag.includes("PRIMARY_CTA_FOCUS") ||
          tag.includes("BOOKING_CTA_FOCUS")
        ) {
          continue;
        }
        // Tab/segment controls: outer has px, active branch only sets bg-bonnet text-white
        if (
          tag.includes('? "bg-bonnet text-white"') ||
          tag.includes("? 'bg-bonnet text-white'") ||
          tag.includes("? `bg-bonnet text-white`") ||
          /\?\s*"bg-bonnet text-white"/.test(tag)
        ) {
          continue;
        }
        offenders.push(
          `${file.replace(process.cwd() + "/", "")}: ${tag.replace(/\s+/g, " ").slice(0, 140)}`,
        );
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
