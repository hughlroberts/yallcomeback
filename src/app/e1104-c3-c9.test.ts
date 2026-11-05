import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("E1104-C3/C4 marketplace notices", () => {
  const page = src("app/marketplace/page.tsx");

  it("C3: half-filled dates show a notice and drop dates from search", () => {
    expect(page).toMatch(/incompleteDates/);
    expect(page).toMatch(/Add both check-in and check-out, or clear the dates\./);
    expect(page).toMatch(/role="alert"/);
  });

  it("C4: guests=0 (non-positive) shows a party-size notice", () => {
    expect(page).toMatch(/guestMessage/);
    expect(page).toMatch(/Guests must be a whole number of at least 1/);
  });
});

describe("E1104-C5 book clamp notices", () => {
  const page = src("app/book/[slug]/page.tsx");

  it("shows guest and pets clamp status notices", () => {
    expect(page).toMatch(/This place sleeps up to/);
    expect(page).toMatch(/petsClamped/);
    expect(page).toMatch(/This place allows up to \{petCap\} pet/);
  });
});

describe("E1104-C6 listing URL prefill", () => {
  it("marketplace listing passes checkIn/checkOut/guests into the widget", () => {
    const page = src("app/marketplace/properties/[slug]/page.tsx");
    expect(page).toMatch(/initialCheckIn=\{sp\.checkIn\}/);
    expect(page).toMatch(/initialCheckOut=\{sp\.checkOut\}/);
    expect(page).toMatch(/initialGuests=/);
  });

  it("host listing redirect keeps trip params for the widget", () => {
    const page = src("app/h/[hostSlug]/properties/[slug]/page.tsx");
    expect(page).toMatch(/listingRedirectQuery/);
    expect(page).toMatch(/q\.set\("checkIn"/);
    expect(page).toMatch(/q\.set\("guests"/);
  });
});

describe("E1104-C7 tap targets ≥24px", () => {
  it("native checkboxes/radios are at least 1.5rem", () => {
    const css = src("app/globals.css");
    expect(css).toMatch(/E1104-C7/);
    expect(css).toMatch(/input\[type="checkbox"\]/);
    expect(css).toMatch(/min-height: 1\.5rem/);
  });

  it("footer, breadcrumb, clear-search and booking selects use min-h-6", () => {
    expect(src("components/site-footer.tsx")).toMatch(/min-h-6/);
    expect(src("app/marketplace/properties/[slug]/page.tsx")).toMatch(
      /inline-flex min-h-6 items-center text-stone-500/,
    );
    expect(src("app/marketplace/page.tsx")).toMatch(
      /inline-flex min-h-6 items-center text-sm font-medium text-bonnet/,
    );
    expect(src("components/booking-widget.tsx")).toMatch(/min-h-6 w-full min-w-0/);
  });
});

describe("E1104-C9 openapi without .json", () => {
  it("serves the spec at /api/v1/openapi", () => {
    const route = src("app/api/v1/openapi/route.ts");
    expect(route).toMatch(/buildOpenApiDocument/);
    expect(route).toMatch(/E1104-C9/);
    const doc = src("lib/agent/openapi.ts");
    expect(doc).toMatch(/"\/api\/v1\/openapi"/);
  });
});

describe("E1104-D2 book guests=0 notice", () => {
  it("shows a notice when guests were coerced up from below 1", () => {
    const page = src("app/book/[slug]/page.tsx");
    expect(page).toMatch(/guestCount\.requested < 1/);
    expect(page).toMatch(/Guests must be at least 1/);
  });
});

describe("E1104-D3 listing prefill warnings", () => {
  const page = src("app/marketplace/properties/[slug]/page.tsx");
  it("rejects impossible dates and warns on min-stay / guest clamps", () => {
    expect(page).toMatch(/prefillNotices/);
    expect(page).toMatch(/isValidYmd/);
    expect(page).toMatch(/Those dates don't look right/);
    expect(page).toMatch(/Minimum stay is/);
    expect(page).toMatch(/This place sleeps up to/);
  });
  it("booking quote rejects impossible YMD instead of Date rollover", () => {
    const quote = src("lib/booking-quote.ts");
    expect(quote).toMatch(/E1104-D3/);
    expect(quote).toMatch(/!isValidYmd\(checkIn\)/);
  });
});
