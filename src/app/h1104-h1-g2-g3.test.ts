import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getShortStayPolicy,
  guestFacingBullets,
} from "@/lib/cancellation-policies";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("H1 cancellation copy single source", () => {
  it("book, things-to-know, and help import policy helpers from cancellation-policies", () => {
    expect(src("app/book/[slug]/page.tsx")).toMatch(
      /from "@\/lib\/cancellation-policies"/,
    );
    expect(src("components/things-to-know.tsx")).toMatch(
      /from "@\/lib\/cancellation-policies"/,
    );
    expect(src("components/help/help-articles.tsx")).toMatch(
      /from "@\/lib\/cancellation-policies"/,
    );
  });

  it("Moderate guest detail matches summary logic (50% unused after one night)", () => {
    const m = getShortStayPolicy("MODERATE");
    const later = guestFacingBullets(m, 5).find((b) => /cancel later/i.test(b));
    expect(m.summary).toMatch(/one night.*50% of unused nights/i);
    expect(later).toMatch(/50% of unused nights after one night is kept/i);
  });
});

describe("G2 footer contact mailto tap target", () => {
  it("host-site-footer contact mailto uses min-h-6; href still host.contactEmail", () => {
    const footer = src("components/host-site-footer.tsx");
    expect(footer).toContain("mailto:${host.contactEmail}");
    expect(footer).toMatch(
      /mailto:\$\{host\.contactEmail\}[\s\S]{0,200}min-h-6/,
    );
  });
});

describe("G3 book print hides details form", () => {
  it("Your details wrapper is no-print; trip summary is not", () => {
    const book = src("app/book/[slug]/page.tsx");
    expect(book).toMatch(/className="no-print mt-10 max-w-xl"/);
    expect(book).toMatch(/Your trip/);
    expect(book).toMatch(
      /Trip summary[\s\S]{0,120}className="mt-6 rounded-2xl[\s\S]{0,400}Your trip/,
    );
    // Your details form is the no-print block, not the trip card
    expect(book).toMatch(/className="no-print mt-10 max-w-xl"/);
  });
});

describe("H2 admin Dashboard label on narrow", () => {
  it("AdminNav shortens Dashboard to Home below sm", () => {
    const nav = src("components/admin-nav.tsx");
    expect(nav).toMatch(/sm:hidden">Home</);
    expect(nav).toMatch(/hidden sm:inline">Dashboard</);
  });
});

describe("H3 property tab scroll fade", () => {
  it("tab rows wrap with mobile fade hint", () => {
    const ws = src("components/admin-listing-workspace.tsx");
    expect(ws).toMatch(/bg-gradient-to-l from-white/);
    expect(ws).toMatch(/sm:hidden/);
  });
});

describe("H4 peak copy matches UI", () => {
  it("intro no longer says Uncheck when checkboxes may be absent", () => {
    const page = src("app/admin/properties/[id]/page.tsx");
    // Always-visible intro must not say Uncheck
    expect(page).toMatch(/Add missing holidays/);
    const intro = page.slice(
      page.indexOf("US long weekends"),
      page.indexOf("US long weekends") + 280,
    );
    expect(intro).not.toMatch(/Uncheck/);
    // Hint next to checkboxes may still say Uncheck
    expect(page).toMatch(/Uncheck holidays that should not be peaks/);
  });
});

describe("H5 blocks tab empty state and Cancel", () => {
  it("lists Cancel link, empty state, and existing Remove", () => {
    const page = src("app/admin/properties/[id]/page.tsx");
    expect(page).toMatch(/No calendar blocks yet/);
    expect(page).toMatch(/>\s*Cancel\s*</);
    expect(page).toMatch(/deleteCalendarBlock/);
  });
});

describe("H6/H7 messages thread chrome", () => {
  it("pins composer/details, hides footer on /messages, mobile details sheet", () => {
    const ws = src("components/messages/messages-workspace.tsx");
    expect(ws).toMatch(/sticky top-0 z-20/);
    expect(ws).toMatch(/sticky bottom-0 z-20/);
    expect(ws).toMatch(/onOpenDetails/);
    expect(ws).toMatch(/detailsOpen/);
    expect(ws).toMatch(/Contact/);
    const gate = src("components/site-footer-gate.tsx");
    expect(gate).toMatch(/\/messages/);
    expect(src("components/site-shell.tsx")).toMatch(/SiteFooterGate/);
  });
});

describe("H8 guest-messages pluralization", () => {
  it("uses your listing for count 1, all N listings otherwise", () => {
    const c = src("components/admin-host-guest-messages.tsx");
    expect(c).toMatch(/your listing/);
    expect(c).toMatch(/all \$\{listingCount\} listings/);
    expect(c).not.toMatch(/all \{listingCount\} listing/);
  });
});

describe("H9 personal email treatment", () => {
  it("view mode masks email in header and row", () => {
    const page = src("app/account/settings/personal/page.tsx");
    expect(page).toMatch(/maskEmail\(user\.email\)/);
    expect(page.match(/maskEmail\(user\.email\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("confirm Block dates / Remove peak / Set price", () => {
  it("properties page confirms block and remove peak", () => {
    const page = src("app/admin/properties/[id]/page.tsx");
    expect(page).toMatch(/Confirm block/);
    expect(page).toMatch(/Remove peak/);
  });
  it("block sheet confirms set price and block dates", () => {
    const sheet = src("components/admin-block-sheet.tsx");
    expect(sheet).toMatch(/confirmPrice/);
    expect(sheet).toMatch(/Confirm price/);
    expect(sheet).toMatch(/confirmBlock/);
    expect(sheet).toMatch(/Confirm block/);
  });
});
