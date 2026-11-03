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
import {
  readStepBlob,
  resolveWizardDraftValues,
  stableSnapshot,
} from "@/lib/listing-wizard-draft";

const DEBOUNCE_MS = 300;

/**
 * Debounced localStorage autosave for one listing-wizard step.
 * Restores the draft on mount unless the server values for this step
 * changed since the draft was started. Pending writes are flushed when the
 * page is hidden, reloaded, or closed, and on unmount.
 */
export function useListingWizardAutosave<T extends Record<string, unknown>>(opts: {
  draftKey: string;
  step: string;
  initial: T;
  /** Property/user updatedAt — only used for drafts saved by older code. */
  serverUpdatedAt?: Date | string | number | null;
}): {
  values: T;
  setValues: Dispatch<SetStateAction<T>>;
  hydrated: boolean;
} {
  const { draftKey, step, initial, serverUpdatedAt } = opts;
  const [values, setValuesState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const latestRef = useRef(values);
  const baseRef = useRef(stableSnapshot(initial));

  const writeNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    saveListingWizardDraft(draftKey, {
      [step]: {
        values: latestRef.current,
        savedAt: Date.now(),
        base: baseRef.current,
      },
    });
  }, [draftKey, step]);

  // Restore once on mount (client).
  useEffect(() => {
    const base = stableSnapshot(initial);
    baseRef.current = base;
    const blob = readStepBlob(loadListingWizardDraft(draftKey), step);
    const { values: next } = resolveWizardDraftValues(
      initial,
      blob,
      toMillis(serverUpdatedAt),
    );
    // Keep the original base while the draft is still in use.
    if (blob && typeof blob.base === "string" && blob.base === base) {
      baseRef.current = blob.base;
    }
    // The draft lives in localStorage, which only exists after mount, so it
    // must be read here; reading it during render would break hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from an external store
    setValuesState(next);
    latestRef.current = next;
    hydratedRef.current = true;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per draft/step
  }, [draftKey, step]);

  const setValues = useCallback(
    (update: SetStateAction<T>) => {
      const prev = latestRef.current;
      const next =
        typeof update === "function"
          ? (update as (p: T) => T)(prev)
          : update;
      latestRef.current = next;
      setValuesState(next);
      if (!hydratedRef.current) return;
      dirtyRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(writeNow, DEBOUNCE_MS);
    },
    [writeNow],
  );

  // Flush on reload / tab close / tab hidden, and on unmount.
  useEffect(() => {
    const onHide = () => writeNow();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") writeNow();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      writeNow();
    };
  }, [writeNow]);

  return { values, setValues, hydrated };
}
