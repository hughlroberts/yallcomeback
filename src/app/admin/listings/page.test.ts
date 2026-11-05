import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("E1104-A6 /admin/listings", () => {
  it("redirects to /admin/properties", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/admin/listings/page.tsx"),
      "utf8",
    );
    expect(src).toContain('redirect("/admin/properties")');
  });
});
