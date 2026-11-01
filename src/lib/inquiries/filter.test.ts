import { describe, expect, it } from "vitest";
import {
  checkInquiryContent,
  countLinks,
  inquiryHash,
  isNearDuplicate,
  normalizeInquiryText,
} from "./filter";

const base = {
  guestName: "Jo Guest",
  guestEmail: "jo@example.com",
  body: "Is the dock deep enough for a pontoon boat? Are dogs OK?",
};

describe("checkInquiryContent", () => {
  it("accepts an ordinary stay question", () => {
    expect(checkInquiryContent(base)).toEqual({ ok: true });
  });

  it("allows one link in the message", () => {
    expect(
      checkInquiryContent({
        ...base,
        body: "Is this the same boat ramp? https://maps.example.org/ramp",
      }).ok,
    ).toBe(true);
  });

  it("requires name, valid email and a real message", () => {
    expect(checkInquiryContent({ ...base, guestName: " " })).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(
      checkInquiryContent({ ...base, guestEmail: "not-an-email" }),
    ).toMatchObject({ ok: false, code: "invalid" });
    expect(checkInquiryContent({ ...base, body: "hi" })).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(
      checkInquiryContent({ ...base, body: "x".repeat(2001) }),
    ).toMatchObject({ ok: false, code: "invalid" });
  });

  it("rejects links in the name or subject, shorteners, markup and link floods", () => {
    expect(
      checkInquiryContent({ ...base, guestName: "cheap-pills.com" }),
    ).toMatchObject({ ok: false, code: "links" });
    expect(
      checkInquiryContent({ ...base, subject: "see www.spam.example" }),
    ).toMatchObject({ ok: false, code: "links" });
    expect(
      checkInquiryContent({ ...base, body: "Look here bit.ly/abc please" }),
    ).toMatchObject({ ok: false, code: "links" });
    expect(
      checkInquiryContent({ ...base, body: 'Hello <a href="x">click</a>' }),
    ).toMatchObject({ ok: false, code: "links" });
    expect(
      checkInquiryContent({
        ...base,
        body: "https://a.example.com and https://b.example.com",
      }),
    ).toMatchObject({ ok: false, code: "links" });
  });

  it("rejects obvious SEO spam", () => {
    expect(
      checkInquiryContent({
        ...base,
        body: "We offer SEO services and quality backlinks for your website ranking.",
      }),
    ).toMatchObject({ ok: false, code: "spam" });
  });
});

describe("dedupe helpers", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizeInquiryText("Hi!! Is it   FREE?")).toBe("hi is it free");
    expect(inquiryHash("Hi!! Is it free?")).toBe(inquiryHash("hi is it free"));
  });

  it("treats near-identical questions as duplicates", () => {
    const a = "Is the dock deep enough for a pontoon boat? Are dogs OK?";
    expect(isNearDuplicate(a, a.toUpperCase())).toBe(true);
    expect(
      isNearDuplicate(
        a,
        "Is the dock deep enough for a pontoon boat? Are dogs OK? thanks",
      ),
    ).toBe(true);
    expect(
      isNearDuplicate(a, "Do you have a crib and a high chair for a baby?"),
    ).toBe(false);
    expect(isNearDuplicate("pets ok", "pets ok?")).toBe(true);
    expect(isNearDuplicate("pets ok", "wifi ok")).toBe(false);
  });

  it("counts links", () => {
    expect(countLinks("no links here")).toBe(0);
    expect(countLinks("see https://x.example.com and www.y.com")).toBe(2);
  });
});
