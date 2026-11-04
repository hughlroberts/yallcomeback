import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/actions/properties", () => ({
  addCalendarBlock: vi.fn(),
  setNightlyPriceForRange: vi.fn(),
}));

import { blockSavedMessage } from "./admin-block-sheet";
import { SaveToast } from "./save-toast";

describe("blockSavedMessage", () => {
  it("names what was saved", () => {
    expect(blockSavedMessage("OWNER", "2 nights", "Nov 6 → Nov 8")).toBe(
      "Owner block saved: 2 nights, Nov 6 → Nov 8.",
    );
    expect(blockSavedMessage("OFFLINE", "1 night", "Nov 6 → Nov 7")).toMatch(
      /^Guest booking saved/,
    );
    expect(blockSavedMessage("OTHER", "1 night", "x")).toMatch(
      /^Dates blocked/,
    );
  });

  it("says when a double tap was already saved", () => {
    expect(blockSavedMessage("OWNER", "1 night", "x", true)).toContain(
      "(already saved)",
    );
  });
});

describe("SaveToast", () => {
  it("renders nothing on the server, so it cannot cause a hydration mismatch", () => {
    expect(
      renderToString(
        createElement(SaveToast, { message: "Saved", onDismiss: () => {} }),
      ),
    ).toBe("");
    expect(
      renderToString(
        createElement(SaveToast, { message: null, onDismiss: () => {} }),
      ),
    ).toBe("");
  });
});
