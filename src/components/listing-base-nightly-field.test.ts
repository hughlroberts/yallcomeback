import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ListingBaseNightlyField E1104-A1", () => {
  const src = readFileSync(
    join(process.cwd(), "src/components/listing-base-nightly-field.tsx"),
    "utf8",
  );

  it("validates on change and blur with the shared $1 minimum helper", () => {
    expect(src).toContain("baseNightlyRateFieldError");
    expect(src).toContain("onBlur");
    expect(src).toContain("onChange");
    expect(src).toContain('min={1}');
    expect(src).toContain('role="alert"');
  });
});

describe("Listing tab uses ListingBaseNightlyField", () => {
  it("wires the client field into the Listing details form", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/admin/properties/[id]/page.tsx"),
      "utf8",
    );
    expect(page).toContain("ListingBaseNightlyField");
    expect(page).not.toMatch(
      /htmlFor="baseNightlyRate">Base nightly rate[\s\S]*?type="number"[\s\S]*?defaultValue=\{property\.baseNightlyRate\}/,
    );
  });

  it("updateProperty rejects a nightly under $1", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/actions/properties.ts"),
      "utf8",
    );
    const fn = actions.slice(actions.indexOf("export async function updateProperty"));
    expect(fn).toContain("baseNightlyRateFieldError");
    expect(fn).toContain("throw new Error(nightlyErr)");
  });
});
