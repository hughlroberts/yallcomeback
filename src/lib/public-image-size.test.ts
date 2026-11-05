import { describe, expect, it } from "vitest";
import { publicImageSize } from "@/lib/public-image-size";

describe("publicImageSize", () => {
  it("reads seed JPEG dimensions", async () => {
    const size = await publicImageSize("/seed/lakefront/01.jpg");
    expect(size).toEqual({ width: 1200, height: 900 });
  });

  it("returns null for remote URLs", async () => {
    expect(await publicImageSize("https://cdn.example/x.jpg")).toBeNull();
  });
});
