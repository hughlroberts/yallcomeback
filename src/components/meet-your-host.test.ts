import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/message-host-form", () => ({
  MessageHostButton: () => null,
}));

import { MeetYourHost } from "./meet-your-host";

const host = {
  name: "Cherokee Landing",
  createdAt: new Date("2015-01-01T00:00:00Z"),
  description:
    "Family-owned resort.\n\n—\nImported from Airbnb\nhttps://www.airbnb.com/users/show/1",
};

const render = (props: Partial<Parameters<typeof MeetYourHost>[0]>) =>
  renderToStaticMarkup(createElement(MeetYourHost, { host, ...props }));

describe("Meet your host card", () => {
  it("shows no years-hosting stat", () => {
    const html = render({ staysHosted: 12, listingCount: 8 });
    expect(html).not.toMatch(/years? hosting/i);
  });

  it("keeps the listings count (with or without stays hosted)", () => {
    const both = render({ staysHosted: 12, listingCount: 8 });
    expect(both).toContain("Stays hosted");
    expect(both).toContain("Listings");
    const one = render({ listingCount: 1 });
    expect(one).toContain("Listing<");
    expect(one).not.toContain("Stays hosted");
  });

  it("renders no empty stats list when there is nothing to show", () => {
    expect(render({})).not.toContain("<dl");
  });

  it("hides an import note in the host's About text", () => {
    const html = render({ listingCount: 2 });
    expect(html).toContain("Family-owned resort.");
    expect(html).not.toMatch(/airbnb/i);
  });
});
