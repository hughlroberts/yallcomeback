import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("@/app/actions/guest-cancel", () => ({ guestCancelBooking: vi.fn() }));

import { ConfirmSubmitButton } from "./confirm-submit-button";
import { GuestCancelPanel } from "./guest-cancel-panel";

const root = path.resolve(__dirname, "../..");
const src = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("admin cancel needs a second tap", () => {
  it("first render has no submit button", () => {
    const html = renderToStaticMarkup(
      createElement(ConfirmSubmitButton, {
        label: "Cancel booking (frees calendar)",
        question: "Cancel?",
        confirmLabel: "Yes, cancel booking",
      }),
    );
    expect(html).toContain("Cancel booking (frees calendar)");
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("Yes, cancel booking");
  });

  it("admin booking page uses the confirm button for cancel", () => {
    const page = src("src/app/admin/bookings/[id]/page.tsx");
    const block = page.slice(page.indexOf("<form action={cancelBooking}"));
    expect(block).toContain("<ConfirmSubmitButton");
    expect(block.slice(0, block.indexOf("</form>"))).not.toMatch(
      /<Button type="submit"/,
    );
  });
});

describe("guest cancel panel", () => {
  const props = {
    bookingId: "bk_1",
    token: "tok123",
    noun: "request" as const,
    deadlineText: "You can cancel online until Dec 15.",
    moneyText: "No payment has been taken.",
  };

  it("starts closed: one tap opens, no submit yet", () => {
    const html = renderToStaticMarkup(createElement(GuestCancelPanel, props));
    expect(html).toContain("Cancel request");
    expect(html).not.toContain('type="submit"');
  });

  it("email cancel link opens the confirm step, which still needs a tap", () => {
    const html = renderToStaticMarkup(
      createElement(GuestCancelPanel, { ...props, startOpen: true }),
    );
    expect(html).toContain("Yes, cancel request");
    expect(html).toContain('type="submit"');
    expect(html).toContain('name="t" value="tok123"');
    expect(html).toContain("Keep my request");
  });
});

describe("wiring", () => {
  it("createBooking emails guest + hosts (card checkouts email from the webhook)", () => {
    const actions = src("src/app/actions/bookings.ts");
    expect(actions).toContain("sendBookingCreatedEmails(booking.id)");
    const hook = src("src/app/api/stripe/webhook/route.ts");
    expect(hook).toContain('outcome === "confirmed"');
    expect(hook).toContain("sendBookingCreatedEmails(bookingId)");
    expect(hook).toContain('sendCancellationEmails(bookingId, "SYSTEM")');
  });

  it("host cancel goes through the shared cancel + email path", () => {
    const actions = src("src/app/actions/bookings.ts");
    const fn = actions.slice(
      actions.indexOf("export async function cancelBooking"),
    );
    expect(fn.slice(0, 1200)).toContain("cancelBookingRecord(");
    expect(fn.slice(0, 1200)).toContain('by: "HOST"');
  });

  it("confirmation page offers cancel or 'Contact host to cancel'", () => {
    const page = src("src/app/book/confirmation/[id]/page.tsx");
    expect(page).toContain("<GuestCancelPanel");
    expect(page).toContain("Contact host to cancel");
    expect(page).toContain('startOpen={sp.cancel === "1"}');
  });
});
