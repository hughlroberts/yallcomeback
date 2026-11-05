import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("AdminAmenitiesEditor E1104-A3", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/admin-amenities-editor.tsx"),
    "utf8",
  );

  it("renders the checkmark only when the amenity is selected", () => {
    expect(src).toContain('{selected ? "✓" : null}');
    expect(src).not.toMatch(/text-transparent[\s\S]{0,80}✓/);
  });

  it("shows a selected.size counter in the header", () => {
    expect(src).toContain("{selected.size} selected");
  });
});
