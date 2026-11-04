import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/calendar",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/listing-lifecycle", () => ({
  pauseListing: vi.fn(),
  resumeListing: vi.fn(),
  archiveListing: vi.fn(),
  restoreListing: vi.fn(),
  deleteListing: vi.fn(),
}));
vi.mock("@/app/actions/properties", () => ({
  deleteProperty: vi.fn(),
  addSeason: vi.fn(),
  applyPeakHolidays: vi.fn(),
  deleteSeason: vi.fn(),
  duplicateProperty: vi.fn(),
  updatePropertyPricing: vi.fn(),
  updateSeason: vi.fn(),
  addCalendarBlock: vi.fn(),
  setNightlyPriceForRange: vi.fn(),
}));

import { AdminListingWorkspace } from "./admin-listing-workspace";
import { hostTodayYmd } from "@/lib/host-today";

type Props = Parameters<typeof AdminListingWorkspace>[0];

const props: Omit<Props, "todayYmd"> = {
  calendarOnly: true,
  property: {
    id: "p1",
    title: "Lake House",
    slug: "lake-house",
    hostSlug: "hugh",
    published: true,
    listOnMarketplace: true,
    hostMarketplaceOn: true,
    city: "Austin",
    region: "TX",
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    baseNightlyRate: 150,
    weekendPremiumPercent: 10,
    cleaningFee: 50,
    petFee: 0,
    petFeeUnit: "PER_STAY",
    petsAllowed: false,
    maxPets: 0,
    defaultMinNights: 1,
    images: [],
  } as unknown as Props["property"],
  seasons: [],
  blocks: [
    {
      id: "b1",
      startDate: "2026-10-31",
      endDate: "2026-11-02",
      occupantName: "Owner",
      guestCount: null,
      blockType: "OWNER",
      source: "MANUAL",
      connectionName: null,
    },
  ] as unknown as Props["blocks"],
  bookings: [],
};

function renderIn(tz: string, withToday: boolean) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return renderToString(
      createElement(AdminListingWorkspace, {
        ...props,
        ...(withToday ? { todayYmd: hostTodayYmd() } : {}),
      } as Props),
    );
  } finally {
    process.env.TZ = prev;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AdminListingWorkspace hydration", () => {
  it("server (UTC) and phone (US zone) render the same calendar at 10 PM CDT", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T03:04:00Z")); // Oct 31, 10:04 PM CDT
    const server = renderIn("UTC", true);
    const phone = renderIn("America/Chicago", true);
    const west = renderIn("America/Los_Angeles", true);
    expect(phone).toBe(server);
    expect(west).toBe(server);
    expect(server).toContain("October 2026");
  });

  it("matches even without the server prop", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T03:04:00Z"));
    expect(renderIn("America/Chicago", false)).toBe(renderIn("UTC", false));
  });
});

describe("T58: Find a Place link opens the public listing page", () => {
  it("is a real new-tab link to /marketplace/properties/[slug]", () => {
    const html = renderToString(
      createElement(AdminListingWorkspace, {
        ...props,
        calendarOnly: false,
        todayYmd: "2026-11-03",
      } as Props),
    );
    const m = /<a[^>]*data-testid="find-a-place-link"[^>]*>/.exec(html);
    expect(m, "Find a Place link rendered").not.toBeNull();
    const tag = m![0];
    expect(tag).toContain('href="/marketplace/properties/lake-house?host=hugh"');
    expect(tag).toContain('target="_blank"');
    expect(tag).toContain('rel="noopener noreferrer"');
    expect(html).toMatch(/<a[^>]*href="\/marketplace\/properties\/lake-house\?host=hugh"[^>]*>View listing<\/a>/);
    expect(html).not.toContain("about:blank");
  });
});

describe("T58: paused listing still links to the host preview", () => {
  it("shows a new-tab preview link and View listing", () => {
    const html = renderToString(
      createElement(AdminListingWorkspace, {
        ...props,
        property: { ...props.property, published: false } as Props["property"],
        calendarOnly: false,
        todayYmd: "2026-11-03",
      } as Props),
    );
    const m = /<a[^>]*data-testid="paused-preview-link"[^>]*>/.exec(html);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('href="/marketplace/properties/lake-house?host=hugh"');
    expect(m![0]).toContain('target="_blank"');
    expect(html).toMatch(/<a[^>]*href="\/marketplace\/properties\/lake-house\?host=hugh"[^>]*>View listing<\/a>/);
  });
});

describe("T58b: paused links use the signed preview and have an Open here twin", () => {
  it("View listing, Preview, Website and Find a Place all point at the preview", () => {
    const previewHref = "/marketplace/properties/lake-house?host=hugh&preview=123.sig";
    const html = renderToString(
      createElement(AdminListingWorkspace, {
        ...props,
        property: { ...props.property, published: false, previewHref } as Props["property"],
        calendarOnly: false,
        todayYmd: "2026-11-03",
      } as Props),
    );
    const amp = previewHref.replace(/&/g, "&amp;");
    for (const id of ["paused-preview-link", "view-listing-link", "find-a-place-link"]) {
      const tab = new RegExp(`<a[^>]*data-testid="${id}"[^>]*>`).exec(html)?.[0] ?? "";
      expect(tab, id).toContain(`href="${amp}"`);
      expect(tab, id).toContain('target="_blank"');
      expect(tab, id).toContain('rel="noopener noreferrer"');
      const here = new RegExp(`<a[^>]*data-testid="${id}-here"[^>]*>`).exec(html)?.[0] ?? "";
      expect(here, id).toContain(`href="${amp}"`);
      expect(here, id).toContain('target="_self"');
    }
    const web = /<a[^>]*data-testid="website-link"[^>]*>/.exec(html)?.[0] ?? "";
    expect(web).toContain('href="/h/hugh/properties/lake-house?preview=123.sig"');
  });
});
