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

/** `?welcome=1` (or true/yes) forces the welcome overlay, e.g. for demos and QA. */
export function isWelcomeForced(raw: string | string[] | undefined | null): boolean {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Whether the platform home shows the Find / Host welcome overlay. */
export function shouldShowIntentGate(input: {
  isTenantSite: boolean;
  isHostOrAdmin: boolean;
  intentCookie: string | undefined | null;
  welcomeParam?: string | string[] | null;
}): boolean {
  // Host custom sites never show the marketplace fork.
  if (input.isTenantSite) return false;
  // Forced: ignore the cookie (and role) so anyone can preview it.
  if (isWelcomeForced(input.welcomeParam)) return true;
  return (
    !input.isHostOrAdmin &&
    parseVisitIntent(input.intentCookie) == null
  );
}
