export const HOST_PASSWORD_MIN_LENGTH = 8;

export const HOST_PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (pw: string): boolean => pw.length >= HOST_PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "At least one uppercase letter",
    test: (pw: string): boolean => /[A-Z]/.test(pw),
  },
  {
    id: "lowercase",
    label: "At least one lowercase letter",
    test: (pw: string): boolean => /[a-z]/.test(pw),
  },
  {
    id: "numberOrSpecial",
    label: "At least one number or special character",
    test: (pw: string): boolean => /[0-9]|[^A-Za-z0-9\s]/.test(pw),
  },
] as const;

const RULE_REQUIREMENTS: Record<string, string> = {
  length: "at least 8 characters",
  uppercase: "an uppercase letter",
  lowercase: "a lowercase letter",
  numberOrSpecial: "a number or special character",
};

/** Returns a human-readable error listing every unmet host password rule, or null. */
export function validateHostPassword(pw: string): string | null {
  if (!pw) return "Password is required.";

  const missing = HOST_PASSWORD_RULES.filter((rule) => !rule.test(pw)).map(
    (rule) => RULE_REQUIREMENTS[rule.id],
  );
  if (missing.length === 0) return null;
  if (missing.length === 1) return `Password must include ${missing[0]}.`;
  const last = missing.pop();
  return `Password must include ${missing.join(", ")}, and ${last}.`;
}
