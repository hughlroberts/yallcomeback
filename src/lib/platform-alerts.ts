/**
 * Platform admin alert inbox (Hugh, Nov 2026: "move the admin emails to
 * yallcomebackapp@gmail.com"). Every platform/ops alert email goes here,
 * not to individual ADMIN user accounts:
 * - Domain setup alerts (a brand adds or changes its custom domain);
 * - Full setup purchased ($500 setup service, paid or invoiced);
 * - Second Full setup payment (duplicate setup payment).
 *
 * PLATFORM_ALERT_EMAIL (comma-separated) overrides the default when set.
 * Host / brand notifications (inquiries, bookings, billing) are brand-specific
 * and never use this inbox.
 */
export const DEFAULT_PLATFORM_ALERT_EMAIL = "yallcomebackapp@gmail.com";

/** Pure: the alert inbox list. Lowercase, valid-looking, no repeats. */
export function platformAlertRecipients(
  envValue: string | undefined = process.env.PLATFORM_ALERT_EMAIL,
): string[] {
  const out = new Set<string>();
  for (const raw of (envValue || "").split(",")) {
    const e = raw.trim().toLowerCase();
    if (e.includes("@") && !/\s/.test(e)) out.add(e);
  }
  if (out.size === 0) out.add(DEFAULT_PLATFORM_ALERT_EMAIL);
  return [...out];
}
