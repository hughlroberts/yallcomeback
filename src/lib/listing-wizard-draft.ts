/**
 * Pure helpers for the listing-wizard localStorage draft.
 * Kept free of React so they can be unit tested.
 */

export type WizardStepBlob = {
  values?: Record<string, unknown>;
  savedAt?: number;
  /** Snapshot of the server values the draft was started from. */
  base?: string;
};

/** JSON with sorted object keys, so equal values give equal strings. */
export function stableSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, (v as Record<string, unknown>)[k]]),
      );
    }
    return v;
  });
}

export function readStepBlob(
  draft: Record<string, unknown> | null,
  step: string,
): WizardStepBlob | null {
  if (!draft) return null;
  const raw = draft[step];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as WizardStepBlob;
}

/**
 * Decide what a step shows on load.
 *
 * - New drafts carry `base` (the server values when typing started). Restore
 *   when the server still holds those values. If the server values changed
 *   (this step was saved), the server wins. Saves on other steps and clock
 *   skew do not matter.
 * - Old drafts without `base` fall back to "draft newer than server".
 */
export function resolveWizardDraftValues<T extends Record<string, unknown>>(
  initial: T,
  blob: WizardStepBlob | null,
  serverUpdatedMs: number | null,
): { values: T; restored: boolean } {
  if (!blob?.values || typeof blob.values !== "object") {
    return { values: initial, restored: false };
  }
  let fresh: boolean;
  if (typeof blob.base === "string") {
    fresh = blob.base === stableSnapshot(initial);
  } else {
    const savedAt = typeof blob.savedAt === "number" ? blob.savedAt : null;
    fresh = savedAt == null || serverUpdatedMs == null || savedAt > serverUpdatedMs;
  }
  if (!fresh) return { values: initial, restored: false };
  const merged = { ...initial, ...(blob.values as Partial<T>) } as T;
  return { values: merged, restored: true };
}
