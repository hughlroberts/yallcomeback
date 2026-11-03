import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ prisma: {} }));

import { marketplacePropertyWhere } from "./host";

describe("Find a Place filter (T45)", () => {
  it("hides Platform listings while the brand is suspended for no card", () => {
    const where = marketplacePropertyWhere();
    const platform = where.host.OR.find((b) => b.hostingMode === "PLATFORM") as Record<string, unknown>;
    expect(platform.marketplaceSuspendedAt).toBeNull();
    // Self-host brands are never affected.
    const self = where.host.OR.find((b) => b.hostingMode === "SELF") as Record<string, unknown>;
    expect(self).toEqual({ hostingMode: "SELF" });
  });
});
