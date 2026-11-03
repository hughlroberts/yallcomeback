import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
import { AdminListingSwitcher } from "./admin-listing-switcher";
import { visibilityFromFlags, visibilityLabel } from "@/lib/listing-visibility";

type Props = Parameters<typeof AdminListingWorkspace>[0];

const title = "Cherokee Landing Lake Cabin";
const property = {
  id: "p1", title, slug: "cabin", hostSlug: "cherokee", published: true,
  listOnMarketplace: true, hostMarketplaceOn: true, city: "Austin", region: "TX",
  bedrooms: 2, bathrooms: 1, maxGuests: 4, baseNightlyRate: 150,
  weekendPremiumPercent: 10, cleaningFee: 50, petFee: 0, petFeeUnit: "PER_STAY",
  petsAllowed: false, maxPets: 0, defaultMinNights: 1, images: [],
} as unknown as Props["property"];


describe("/admin/calendar header", () => {
  it("does not repeat the title and status the stay switcher already shows", () => {
    const status = visibilityLabel(visibilityFromFlags(true, true));
    const switcher = renderToString(
      createElement(AdminListingSwitcher, {
        stackFrom: "lg",
        activeId: "p1",
        listings: [{ id: "p1", title, published: true, listOnMarketplace: true, coverUrl: null }],
      }),
    );
    const workspace = renderToString(
      createElement(AdminListingWorkspace, {
        calendarOnly: true, property, seasons: [], blocks: [], bookings: [],
        todayYmd: "2026-11-02",
      } as Props),
    );
    // Switcher is the one place for them.
    expect(switcher).toContain(`>${title}<`);
    expect(switcher).toContain(`>${status}<`);
    // Workspace header does not repeat them.
    expect(workspace).not.toContain(`>${title}<`);
    expect(workspace).not.toContain(`>${status}<`);
    expect(workspace).toContain(">Calendar</h1>");
  });
});
