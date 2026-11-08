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
    expect(page).toMatch(/initialCheckIn=\{initialCheckIn/);
    expect(page).toMatch(/initialCheckOut=\{initialCheckOut/);
    expect(page).toMatch(/initialGuests=\{guestCount\.guests\}/);
  });

  it("host listing inline renderer keeps trip params for the widget", () => {
    const page = src("app/h/[hostSlug]/properties/[slug]/page.tsx");
    expect(page).toContain('searchParams={Promise.resolve(sp)}');
    expect(page).toContain('<ListingPage');
    expect(page).not.toContain('redirect(');
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

describe("E1104-C7 leftovers tap targets ≥24px", () => {
  it("View all stays / Learn more / Terms / Free self-host use min-h-6", () => {
    expect(src("app/page.tsx")).toMatch(/View all stays[\s\S]{0,80}min-h-6|min-h-6[\s\S]{0,120}View all stays/);
    expect(src("components/things-to-know.tsx")).toMatch(/inline-flex min-h-6[\s\S]*Learn more/);
    expect(src("app/register/page.tsx")).toMatch(/inline-flex min-h-6 items-center font-medium text-bonnet underline/);
    expect(src("components/HostSignupForm.tsx")).toMatch(/min-h-6[\s\S]{0,200}Free self-host/);
    expect(src("components/HostSignupForm.tsx")).toMatch(/inline-flex min-h-6 items-center rounded-sm font-medium text-bonnet/);
    expect(src("components/mobile-reserve-bar.tsx")).toMatch(/line-clamp-2 min-h-6 text-xs/);
  });
});

describe("E1104-D4 test brands sitemap + noindex", () => {
  it("excludes isTestBrand from sitemap and marks host/listing noindex", () => {
    const sm = src("app/sitemap.ts");
    expect(sm).toMatch(/isTestBrand: false/);
    expect(sm).not.toMatch(/cherokee/i);
    expect(src("app/h/[hostSlug]/layout.tsx")).toMatch(
      /noIndex: Boolean\(host\.isTestBrand\)/,
    );
    expect(src("app/marketplace/properties/[slug]/page.tsx")).toMatch(
      /noIndex: Boolean\(property\.host\.isTestBrand\)/,
    );
  });
});

describe("E1104-D5 marketplace sort/filters notices", () => {
  it("visibly ignores sort and min>max; messages for 0 results", () => {
    const page = src("app/marketplace/page.tsx");
    expect(page).toMatch(/sortIgnored/);
    expect(page).toMatch(/priceOrderMessage/);
    expect(page).toMatch(/No stays match these filters/);
    expect(page).toMatch(/role="status"/);
  });
});

describe("E1104-D6 listing Open Graph", () => {
  it("absolutizes images and passes real dimensions", () => {
    const seo = src("lib/seo.ts");
    expect(seo).toMatch(/seoAbsoluteImageUrl/);
    expect(seo).toMatch(/imageWidth/);
    expect(seo).toMatch(/E1104-D6/);
    const page = src("app/marketplace/properties/[slug]/page.tsx");
    expect(page).toMatch(/publicImageSize/);
    expect(page).toMatch(/type: "website"/);
    expect(page).toMatch(/imageWidth: coverSize\?\.width/);
  });
});

describe("E1104-D7 register autocomplete", () => {
  it("sets name, email, and new-password autocomplete", () => {
    const page = src("app/register/page.tsx");
    expect(page).toMatch(/autoComplete="name"/);
    expect(page).toMatch(/autoComplete="email"/);
    expect(page).toMatch(/autoComplete="new-password"/);
  });
});

describe("E1104-D8 message host a11y", () => {
  it("labels fields, hides honeypot, names the close button", () => {
    const form = src("components/message-host-form.tsx");
    const contact = src("components/message-host-contact-fields.tsx");
    // Unique ids via useId + htmlFor so SRs get accessible names.
    expect(contact).toMatch(/useId\(\)/);
    expect(contact).toMatch(/htmlFor=\{guestNameId\}/);
    expect(contact).toMatch(/htmlFor=\{guestEmailId\}/);
    expect(contact).toMatch(/htmlFor=\{guestPhoneId\}/);
    expect(contact).toMatch(/>Your name</);
    expect(contact).toMatch(/>Email</);
    expect(contact).toMatch(/>Phone \(optional\)</);
    expect(form).toMatch(/MessageHostContactFields/);
    expect(form).toMatch(/aria-hidden="true"/);
    expect(form).toMatch(/tabIndex=\{-1\}/);
    expect(form).toMatch(/-left-\[10000px\]/);
    expect(form).toMatch(/aria-label="Close message form"/);
  });
});

describe("E1104-D1 welcome Esc dismiss", () => {
  it("Esc submits browse intent (intentional; not a pageview beacon)", () => {
    const gate = src("components/first-visit-intent.tsx");
    expect(gate).toMatch(/E1104-D1/);
    expect(gate).toMatch(/browseFormRef\.current\?\.requestSubmit/);
    expect(gate).toMatch(/setVisitIntent/);
  });
});

describe("E1104-C8 invalid_date over incomplete_dates", () => {
  it("validates YMD before the incomplete pair check", () => {
    const route = src("app/api/v1/search/route.ts");
    expect(route).toMatch(/E1104-C8/);
    expect(route).toMatch(/!isValidYmd\(checkIn\)/);
    const invalidReturn = route.indexOf('return bad(\n      "invalid_date"');
    const incompleteReturn = route.indexOf('return bad(\n      "incomplete_dates"');
    expect(invalidReturn).toBeGreaterThan(-1);
    expect(incompleteReturn).toBeGreaterThan(invalidReturn);
  });
});
