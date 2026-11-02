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
    expect(c).toContain(
      "lg:max-h-[calc(100vh-var(--site-header-h,calc(5.5rem+1px))-3rem)]",
    );
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

  it("listing page sticks the column 1.5rem below the measured header", () => {
    const page = readFileSync(
      path.resolve(__dirname, "../app/marketplace/properties/[slug]/page.tsx"),
      "utf8",
    );
    expect(page).toContain(
      "lg:sticky lg:top-[calc(var(--site-header-h,calc(5.5rem+1px))+1.5rem)]",
    );
  });
});

describe("site headers publish their height for sticky offsets", () => {
  const read = (p: string) => readFileSync(path.resolve(__dirname, p), "utf8");
  it.each(["site-header.tsx", "host-site-header.tsx"])("%s", (p) => {
    expect(read(p)).toMatch(/<header[^>]*>\s*<HeaderHeightVar \/>/);
  });

  it("card offset and max-height use the same header variable and gaps", () => {
    // top = header + 1.5rem; max-height = 100vh - header - 1.5rem top - 1.5rem bottom
    const card = classOf("booking-card").find((x) =>
      x.startsWith("lg:max-h-"),
    )!;
    expect(card).toContain("var(--site-header-h,calc(5.5rem+1px))-3rem");
  });
});
