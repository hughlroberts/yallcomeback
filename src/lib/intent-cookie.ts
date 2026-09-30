/**
 * First-visit fork on the platform home (`/`).
 * Safe for any bundle (no next/headers).
 */
export const INTENT_COOKIE = "ycb_intent";

/** ~1 year. Overlay should not reappear for a returning browser. */
export const INTENT_MAX_AGE = 60 * 60 * 24 * 365;

export const VISIT_INTENTS = ["find", "host", "browse"] as const;
export type VisitIntent = (typeof VISIT_INTENTS)[number];

export function parseVisitIntent(raw: string | undefined | null): VisitIntent | null {
  const v = raw?.trim().toLowerCase();
  if (v === "find" || v === "host" || v === "browse") return v;
  return null;
}
