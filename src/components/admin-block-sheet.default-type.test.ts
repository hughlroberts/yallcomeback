/**
 * T49: "Block or log a stay" Type defaults to a guest booking (OFFLINE,
 * shown as "Guest booking (offline)") every time the form opens, and only
 * changes when the host picks another type. Enum values are unchanged.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/properties", () => ({
  addCalendarBlock: vi.fn(),
  setNightlyPriceForRange: vi.fn(),
}));

import { AdminBlockSheet } from "./admin-block-sheet";
import {
  BLOCK_TYPE_OPTIONS,
  DEFAULT_BLOCK_TYPE,
  blockTypeForSheet,
} from "@/lib/block-types";
import { blockTypeLabel } from "@/lib/admin-bookings";

function renderSheet(startDate: string, endDate: string) {
  return renderToStaticMarkup(
    createElement(AdminBlockSheet, {
      open: true,
      propertyId: "p1",
      baseNightlyRate: 150,
      startDate,
      endDate,
      onClose: () => {},
      onOpenFullBlocks: () => {},
    }),
  );
}

function selectedType(html: string): string | null {
  const select = html.match(/<select[^>]*name="blockType"[^>]*>([\s\S]*?)<\/select>/);
  if (!select) return null;
  const opt = select[1].match(/<option value="([A-Z]+)" selected="">/);
  return opt ? opt[1] : null;
}

describe("Block or log a stay: Type default", () => {
  it("the default is the guest booking type (OFFLINE)", () => {
    expect(DEFAULT_BLOCK_TYPE).toBe("OFFLINE");
    expect(BLOCK_TYPE_OPTIONS[0]).toEqual({ value: "OFFLINE", label: "Guest booking (offline)" });
  });

  it("labels change only; the stored values stay the same five", () => {
    expect(BLOCK_TYPE_OPTIONS.map((o) => o.value).sort()).toEqual(
      ["FRIENDS", "MAINTENANCE", "OFFLINE", "OTHER", "OWNER"],
    );
    expect(blockTypeLabel("OFFLINE")).toBe("Guest booking (offline)");
    expect(blockTypeLabel("FRIENDS")).toBe("Friends & family");
  });

  it("the opened sheet shows Guest booking (offline) selected, not Friends & family", () => {
    const html = renderSheet("2026-11-06", "2026-11-08");
    expect(html).toContain("Block or log a stay");
    expect(selectedType(html)).toBe("OFFLINE");
    expect(html).toContain(">Guest booking (offline)</option>");
    expect(html).not.toMatch(/value="FRIENDS" selected/);
  });

  it("opening again for another range starts at the default again", () => {
    expect(selectedType(renderSheet("2026-12-01", "2026-12-03"))).toBe("OFFLINE");
  });

  it("the form opts out of browser form restore (mobile Safari / Chrome)", () => {
    const html = renderSheet("2026-11-06", "2026-11-08");
    expect(html).toMatch(/<select[^>]*name="blockType"[^>]*autoComplete="off"|<select[^>]*autoComplete="off"[^>]*name="blockType"/i);
  });
});

describe("blockTypeForSheet (reset rule)", () => {
  it("resets to the default when the sheet opens", () => {
    // closed ("") -> open for a range, after the host had picked Owner use
    expect(blockTypeForSheet("", "2026-11-06|2026-11-08", true, "OWNER")).toBe("OFFLINE");
    // reopened for the same range after closing
    expect(blockTypeForSheet("", "2026-11-06|2026-11-08", true, "FRIENDS")).toBe("OFFLINE");
    // still open, new range picked
    expect(blockTypeForSheet("2026-11-06|2026-11-08", "2026-11-10|2026-11-12", true, "MAINTENANCE")).toBe("OFFLINE");
  });

  it("keeps the host's pick while the sheet stays open", () => {
    expect(blockTypeForSheet("2026-11-06|2026-11-08", "2026-11-06|2026-11-08", true, "OWNER")).toBe("OWNER");
  });

  it("closing does not change it (the next open resets it)", () => {
    expect(blockTypeForSheet("2026-11-06|2026-11-08", "", false, "OWNER")).toBe("OWNER");
  });
});
