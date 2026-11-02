import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.resolve(__dirname, "booking-widget.tsx"), "utf8");

const classOf = (testId: string) => {
  const m = src.match(
    new RegExp(`data-testid="${testId}"\\s+className="([^"]+)"`),
  );
  if (!m) throw new Error(`no ${testId}`);
  return m[1].split(/\s+/);
};

describe("desktop booking card fits the viewport", () => {
  it("caps the card at the viewport below the sticky offset (lg only)", () => {
    const c = classOf("booking-card");
    expect(c).toContain("lg:max-h-[calc(100vh-8.5rem)]");
    expect(c).toContain("lg:flex");
    expect(c).toContain("lg:flex-col");
    // Mobile keeps its normal padding and no height cap.
    expect(c).toContain("p-4");
    expect(c.some((x) => x.startsWith("max-h-"))).toBe(false);
  });

  it("scrolls the calendar and quote inside the card", () => {
    const c = classOf("booking-card-body");
    expect(c).toContain("lg:overflow-y-auto");
    expect(c).toContain("lg:min-h-0");
    expect(c).toContain("lg:flex-1");
  });

  it("keeps the book button in a footer outside the scroll area", () => {
    const c = classOf("booking-card-footer");
    expect(c).toContain("lg:shrink-0");
    const body = src.indexOf('data-testid="booking-card-body"');
    const footer = src.indexOf('data-testid="booking-card-footer"');
    const button = src.indexOf("Request to book");
    expect(body).toBeGreaterThan(-1);
    expect(footer).toBeGreaterThan(body);
    expect(button).toBeGreaterThan(footer);
  });

  it("listing page keeps the column sticky under the header", () => {
    const page = readFileSync(
      path.resolve(__dirname, "../app/marketplace/properties/[slug]/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(
      /listing-reserve-column"[\s\S]{0,80}lg:sticky lg:top-28/,
    );
  });
});
