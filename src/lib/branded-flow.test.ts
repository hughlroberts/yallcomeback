import { describe, it, expect } from "vitest";
import { guestFlowPath, sameBrand } from "./branded-flow";
describe("K1 brand isolation and guest paths", () => {
 it("keeps branded listing, book, confirmation and cancel paths in their brand", () => {
  for (const path of ["/properties/cabin", "/book/cabin", "/book/confirmation/b1?t=token&cancel=1"]) {
   expect(guestFlowPath("qa-host", path)).toBe(`/h/qa-host${path}`);
   expect(guestFlowPath(null, path)).toBe(path);
  }
 });
 it("requires an exact tenant match, never falling back to a foreign listing", () => {
  expect(sameBrand("qa", "qa")).toBe(true);
  expect(sameBrand("qa", "other")).toBe(false);
  expect(sameBrand(null, "other")).toBe(true);
 });
});
