import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const src = (p: string) => readFileSync(`src/${p}`, "utf8");
describe("393px admin regressions", () => {
 it("wraps all admin labels rather than clipping a scroll strip", () => {
  const nav = src("components/admin-nav.tsx");
  expect(nav).toContain("flex-wrap");
  expect(nav).not.toContain("overflow-x-auto");
 });
 it("stacks seasonal date rows and gives selects their own full-width mobile row", () => {
  const page = src("app/admin/properties/[id]/page.tsx");
  expect(page).toContain('data-testid="season-ranges"');
  expect(page).toContain("block sm:table");
  expect(page).toContain("w-full min-w-0 sm:w-auto");
 });
 it("does not shrink chart text below 12px via SVG scaling", () => {
  const chart = src("components/earnings/performance-charts.tsx");
  expect(chart.match(/min-w-\[640px\]/g)).toHaveLength(2);
  expect(chart).not.toContain("fontSize={11}");
 });
 it("renders only the canonical member access label for owners", () => {
  const team = src("app/admin/team/page.tsx");
  expect(team).toContain("hostAccessLabel(level)");
  expect(team).not.toContain('>Owner</p>');
 });
});
