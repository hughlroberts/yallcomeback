import { describe, expect, it } from "vitest";
import { shortStayTitle } from "@/lib/stay-title";

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
