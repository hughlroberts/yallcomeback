import { describe, expect, it } from "vitest";
import { shortStayTitle, switcherStayLabels } from "@/lib/stay-title";

describe("shortStayTitle", () => {
  it("drops a brand @ suffix", () => {
    expect(shortStayTitle("Kitchenette 1 @ Cherokee Landing")).toBe(
      "Kitchenette 1",
    );
  });

  it("drops a possessive brand prefix", () => {
    expect(shortStayTitle("Cherokee Landing's Lower Eagles Nest", 22)).toBe(
      "Lower Eagles Nest",
    );
  });

  it("ellipsizes when the box is still too small", () => {
    expect(shortStayTitle("Back Eagles Nest Lakeside Cabin", 16)).toBe(
      "Back Eagles…",
    );
  });

  it("keeps a short name as-is", () => {
    expect(shortStayTitle("Upper Eagles Nest", 22)).toBe("Upper Eagles Nest");
  });
});

describe("switcherStayLabels", () => {
  it("keeps similar names distinct instead of cutting them off", () => {
    const labels = switcherStayLabels([
      "Cherokee Landing's Lower Eagles Nest",
      "Cherokee Landing's Upper Eagles Nest",
    ]);
    expect(labels[0]).not.toBe(labels[1]);
    expect(labels[0]).toContain("Lower Eagles Nest");
    expect(labels[1]).toContain("Upper Eagles Nest");
  });

  it("does not add an ellipsis to long names", () => {
    const [label] = switcherStayLabels([
      "Kitchenette Suite With Lake View 2 @ Cherokee Landing",
    ]);
    expect(label).toBe("Kitchenette Suite With Lake View 2");
    expect(label).not.toContain("…");
  });

  it("falls back to the full title when short labels collide", () => {
    const labels = switcherStayLabels([
      "Cabin 1 @ Cherokee Landing",
      "Cabin 1 @ Pine Ridge",
    ]);
    expect(labels).toEqual([
      "Cabin 1 @ Cherokee Landing",
      "Cabin 1 @ Pine Ridge",
    ]);
  });
});
