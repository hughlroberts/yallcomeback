"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  loadListingWizardDraft,
  saveListingWizardDraft,
  toMillis,
} from "@/lib/utils";

const DEBOUNCE_MS = 500;

type StepBlob = {
  values?: Record<string, unknown>;
  savedAt?: number;
};

function readStepBlob(
  draft: Record<string, unknown> | null,
  step: string,
): StepBlob | null {
  if (!draft) return null;
  const raw = draft[step];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as StepBlob;
}

/**
 * Debounced localStorage autosave for one listing-wizard step.
 * Restores draft values on mount when the draft is newer than server data
 * (or when no server timestamp is available).
 */
export function useListingWizardAutosave<T extends Record<string, unknown>>(opts: {
  draftKey: string;
  step: string;
  initial: T;
  /** Property/user updatedAt — drafts older than this are ignored. */
  serverUpdatedAt?: Date | string | number | null;
}): {
  values: T;
  setValues: Dispatch<SetStateAction<T>>;
  hydrated: boolean;
} {
  const { draftKey, step, initial, serverUpdatedAt } = opts;
  const [values, setValuesState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(values);
  latestRef.current = values;

  // Restore once on mount (client).
  useEffect(() => {
    const draft = loadListingWizardDraft(draftKey);
    const blob = readStepBlob(draft, step);
    const draftSavedAt =
      typeof blob?.savedAt === "number" ? blob.savedAt : null;
    const serverMs = toMillis(serverUpdatedAt);

    let next = initial;
    if (blob?.values && typeof blob.values === "object") {
      const draftIsFresh =
        draftSavedAt == null ||
        serverMs == null ||
        draftSavedAt > serverMs;
      if (draftIsFresh) {
        next = { ...initial, ...(blob.values as Partial<T>) };
      }
    }
    setValuesState(next);
    latestRef.current = next;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per draft/step
  }, [draftKey, step]);

  const persist = useCallback(
    (next: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        saveListingWizardDraft(draftKey, {
          [step]: { values: next, savedAt: Date.now() },
        });
      }, DEBOUNCE_MS);
    },
    [draftKey, step],
  );

  const setValues = useCallback(
    (update: SetStateAction<T>) => {
      setValuesState((prev) => {
        const next =
          typeof update === "function"
            ? (update as (p: T) => T)(prev)
            : update;
        latestRef.current = next;
        if (hydrated) persist(next);
        return next;
      });
    },
    [hydrated, persist],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Flush pending write on unmount so a quick navigation does not drop input.
        saveListingWizardDraft(draftKey, {
          [step]: { values: latestRef.current, savedAt: Date.now() },
        });
      }
    };
  }, [draftKey, step]);

  return { values, setValues, hydrated };
}
