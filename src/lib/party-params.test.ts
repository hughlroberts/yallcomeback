import { describe, expect, it } from "vitest";
import {
  partyFromParams,
  plainWholeNumber,
  strictSearchLimitFromParams,
} from "./search-filters";

const from = (q: string) => {
  const sp = new URLSearchParams(q);
  return (k: string) => sp.get(k);
};

describe("plainWholeNumber (shared T53/T54 parser)", () => {
  it("accepts plain digits only", () => {
    expect(plainWholeNumber("12")).toBe(12);
    expect(plainWholeNumber(" 3 ")).toBe(3);
    expect(plainWholeNumber("0")).toBe(0);
    for (const bad of ["2.5", "1e1", "0x10", "-5", "+3", "abc", "", "1,000", null, undefined]) {
      expect(plainWholeNumber(bad), String(bad)).toBeNull();
    }
  });
});

describe("strictSearchLimitFromParams", () => {
  it("rejects 2.5, 1e1 and abc", () => {
    for (const q of ["limit=2.5", "limit=1e1", "limit=abc", "take=1e1"]) {
      expect(strictSearchLimitFromParams(from(q)).ok, q).toBe(false);
    }
    expect(strictSearchLimitFromParams(from("limit=10"))).toEqual({ ok: true, take: 10 });
  });
});

describe("partyFromParams", () => {
  it("passes valid guests/pets and treats missing as not sent", () => {
    expect(partyFromParams(from("guests=6&pets=0"))).toEqual({ ok: true, guests: 6, pets: 0 });
    expect(partyFromParams(from(""))).toEqual({ ok: true, guests: undefined, pets: undefined });
  });
  it("invalid_guests for -5, abc, 0, 2.5, 1e1", () => {
    for (const g of ["-5", "abc", "0", "2.5", "1e1"]) {
      expect(partyFromParams(from(`guests=${g}`)), g).toMatchObject({ ok: false, code: "invalid_guests" });
    }
  });
  it("invalid_pets for -1, abc, 1.5, 1e1, 11, 99 (max 10 in the message)", () => {
    for (const p of ["-1", "abc", "1.5", "1e1", "11", "99"]) {
      expect(partyFromParams(from(`guests=2&pets=${p}`)), p).toMatchObject({ ok: false, code: "invalid_pets" });
    }
  });
  it("accepts pets=10 and names the max for pets=99", () => {
    expect(partyFromParams(from("pets=10"))).toMatchObject({ ok: true, pets: 10 });
    const r = partyFromParams(from("pets=99"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("0 to 10");
  });
});
