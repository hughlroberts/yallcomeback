/** Wizard steps on /admin/properties/<id>/setup. Step 1 (type) is /admin/properties/new. */
export const LISTING_SETUP_FIRST_STEP = 2;
export const LISTING_SETUP_LAST_STEP = 10;

/**
 * Normalize ?step= for an existing draft. Returns the step to show, or a
 * step number to redirect to when the value is not a real setup step
 * (e.g. step=1, which creates the draft and is done once it exists).
 */
export function resolveListingSetupStep(
  raw: string | null | undefined,
): { step: number | "done" } | { redirectTo: number } {
  const v = (raw ?? "").trim();
  if (v === "") return { step: LISTING_SETUP_FIRST_STEP };
  if (v === "done") return { step: "done" };
  const n = Number(v);
  if (!Number.isInteger(n) || n < LISTING_SETUP_FIRST_STEP) {
    return { redirectTo: LISTING_SETUP_FIRST_STEP };
  }
  if (n > LISTING_SETUP_LAST_STEP) return { redirectTo: LISTING_SETUP_LAST_STEP };
  return { step: n };
}
