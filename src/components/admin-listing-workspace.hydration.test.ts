import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/admin/calendar",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/properties", () => ({
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
