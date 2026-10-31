/** Shared rules for changing an account email (publish step + profile). */
export function normalizeNewEmail(
  raw: unknown,
): { email: string } | { error: string } {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  const invalid = { error: "Enter a valid email address." };
  if (!email || /\s/.test(email) || email.length >= 254) return invalid;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return invalid;
  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return invalid;
  }
  return { email };
}
