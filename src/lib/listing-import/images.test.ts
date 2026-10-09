import { describe, expect, it } from "vitest";
import { isOtaCdnImageUrl } from "@/lib/listing-import/images";

describe("isOtaCdnImageUrl", () => {
  it("flags Airbnb muscache hosts", () => {
    expect(
      isOtaCdnImageUrl(
        "https://a0.muscache.com/im/pictures/3fbbbee9-596a-453f-a425-37a8e3fa3899.jpg?im_w=1200",
      ),
    ).toBe(true);
    expect(
      isOtaCdnImageUrl("https://muscache.com/im/pictures/abc.jpg"),
    ).toBe(true);
  });

  it("flags VRBO / Expedia image CDNs", () => {
    expect(
      isOtaCdnImageUrl("https://images.trvl-media.com/lodging/123/photo.jpg"),
    ).toBe(true);
    expect(
      isOtaCdnImageUrl("https://media.expedia.com/photos/stay.png"),
    ).toBe(true);
  });

  it("allows first-party paths and our origin", () => {
    expect(isOtaCdnImageUrl("/seed/lakefront-dock/01.jpg")).toBe(false);
    expect(
      isOtaCdnImageUrl("https://www.yallcomeback.app/seed/lakefront-dock/01.jpg"),
    ).toBe(false);
  });
});
