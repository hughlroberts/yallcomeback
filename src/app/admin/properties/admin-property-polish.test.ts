import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Admin property polish E1104-A4/A7", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/admin/properties/[id]/page.tsx"),
    "utf8",
  );

  it("Photos tab has one Upload photos control (no duplicate Upload image label)", () => {
    expect(src).toContain(">Upload photos</Button>");
    expect(src).not.toContain(">Upload image</Label>");
    expect(src).not.toMatch(/>Upload<\/Button>/);
  });

  it("Blocks Stripe copy reflects Connect account, not only platform keys", () => {
    expect(src).toContain("property.host.stripeAccountId");
    expect(src).toContain("finish card onboarding");
    expect(src).not.toContain(
      "Stripe is on - invoices email a pay link and show in your Stripe Dashboard.",
    );
  });
});
