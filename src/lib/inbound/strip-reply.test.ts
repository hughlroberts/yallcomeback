import { describe, expect, it } from "vitest";
import { htmlToText, stripQuotedReply } from "./strip-reply";

describe("stripQuotedReply", () => {
  it("keeps only the new text from a Gmail reply", () => {
    const t = [
      "Yes, late check-in is fine.",
      "",
      "Thanks!",
      "",
      "On Sun, Nov 1, 2026 at 9:00 AM Lakefront <reply+c-g-x@reply.test> wrote:",
      "> Can we check in at 10pm?",
    ].join("\n");
    expect(stripQuotedReply(t)).toBe("Yes, late check-in is fine.\n\nThanks!");
  });

  it("handles a wrapped 'On … wrote:' line, Outlook and phone signatures", () => {
    expect(
      stripQuotedReply(
        "Sounds good\n\nOn Sun, Nov 1, 2026 at 9:00 AM Hugh\n<h@x.com> wrote:\n> hi",
      ),
    ).toBe("Sounds good");
    expect(
      stripQuotedReply(
        "See you then\r\n\r\n-----Original Message-----\r\nFrom: x",
      ),
    ).toBe("See you then");
    expect(stripQuotedReply("Great\n\nSent from my iPhone")).toBe("Great");
    expect(stripQuotedReply("Great\n-- \nJo Smith\nCEO")).toBe("Great");
    expect(
      stripQuotedReply("ok\n________________________________\nFrom: Hugh"),
    ).toBe("ok");
  });

  it("drops our own email footer", () => {
    expect(
      stripQuotedReply(
        "Thank you\n\n—\nYou can reply to this email, or reply in your inbox: https://x",
      ),
    ).toBe("Thank you");
  });

  it("turns HTML into text and drops quoted blocks", () => {
    expect(
      stripQuotedReply(
        htmlToText(
          '<div>Works for us &amp; thanks</div><div class="gmail_quote">On … wrote: <blockquote>old</blockquote></div>',
        ),
      ),
    ).toBe("Works for us & thanks");
  });
});
