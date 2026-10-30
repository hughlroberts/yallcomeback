import { describe, it, expect } from "vitest";
import {
  HOST_PASSWORD_MIN_LENGTH,
  HOST_PASSWORD_RULES,
  validateHostPassword,
} from "@/lib/host-password";

describe("host password validation", () => {
  it("accepts valid passwords", () => {
    const valid = [
      "Password1!",
      "Abcdefg1",
      "aBcDeFgH1@",
      "ShortPass1!",
      "ThisIsALongPasswordWithNumber1AndSpecial@",
    ];
    for (const pw of valid) {
      expect(validateHostPassword(pw)).toBe(null);
    }
  });

  it("rejects too short passwords", () => {
    expect(validateHostPassword("")).toBe("Password is required.");
    expect(validateHostPassword("Abc1!")).toContain("8 characters");
    expect(validateHostPassword("aBcD1!")).toContain("8 characters");
  });

  it("rejects missing uppercase", () => {
    const pw = "password1!";
    expect(validateHostPassword(pw)).toContain("uppercase");
    expect(validateHostPassword(pw)).not.toContain("lowercase");
  });

  it("rejects missing lowercase", () => {
    const pw = "PASSWORD1!";
    expect(validateHostPassword(pw)).toContain("lowercase");
  });

  it("rejects missing number or special", () => {
    const pw = "Password";
    expect(validateHostPassword(pw)).toContain("number or special character");
  });

  it("allows special character alone to satisfy the last rule (no number needed)", () => {
    const pw = "Password!";
    expect(validateHostPassword(pw)).toBe(null);
    const pw2 = "Password@";
    expect(validateHostPassword(pw2)).toBe(null);
  });

  it("lists multiple missing requirements in error message", () => {
    const pw = "password";
    const error = validateHostPassword(pw)!;
    expect(error).toContain("uppercase");
    expect(error).toContain("number or special character");
    expect(error).toMatch(/must include .*uppercase.*and.*number/);
  });

  it("exposes the correct constants and rule shape", () => {
    expect(HOST_PASSWORD_MIN_LENGTH).toBe(8);
    expect(HOST_PASSWORD_RULES).toHaveLength(4);
    expect(HOST_PASSWORD_RULES[0].id).toBe("length");
    expect(typeof HOST_PASSWORD_RULES[0].test).toBe("function");
    expect(HOST_PASSWORD_RULES.every((r) => typeof r.label === "string")).toBe(
      true,
    );
  });
});

describe("host password error messages", () => {
  it("reads naturally", () => {
    expect(validateHostPassword("password1")).toBe(
      "Password must include an uppercase letter.",
    );
    expect(validateHostPassword("Pass1")).toBe(
      "Password must include at least 8 characters.",
    );
    expect(validateHostPassword("password")).toBe(
      "Password must include an uppercase letter, and a number or special character.",
    );
  });
  it("does not count whitespace as a special character", () => {
    expect(validateHostPassword("Pass word")).not.toBeNull();
  });
});
