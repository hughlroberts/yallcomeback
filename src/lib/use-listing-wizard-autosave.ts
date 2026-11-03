"use client";

import {
  useCallback,
  useEffect,
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
import { createWizardAutosave } from "@/lib/listing-wizard-autosave-core";

const DEBOUNCE_MS = 300;

/**
 * Debounced localStorage autosave for one listing-wizard step.
 *
 * Local input state is the source of truth while the host types: the
 * one-time draft restore on mount is skipped if the host already typed, and
 * no save result is ever written back into the inputs. Pending writes are
 * flushed on blur (call `flush`), step change or submit (call `flush` and
 * read `latest()`), page hide, reload, close, and unmount.
 */
export function useListingWizardAutosave<T extends Record<string, unknown>>(opts: {
  draftKey: string;
  step: string;
  initial: T;
  /** Property/user updatedAt — only used for drafts saved by older code. */
  serverUpdatedAt?: Date | string | number | null;
  /**
   * Read what is in the inputs right now (for text typed before the page
   * finished loading). Return null or {} when there is nothing to read.
   */
  readLive?: () => Partial<T> | null;
}): {
  values: T;
  setValues: Dispatch<SetStateAction<T>>;
  hydrated: boolean;
  /** Save the current local values now. */
  flush: () => void;
  /** The newest local values (newer than `values` inside the same event). */
  latest: () => T;
} {
  const { draftKey, step, initial, serverUpdatedAt, readLive } = opts;
  const [values, setValuesState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  // One autosave per mounted step; draftKey and step are fixed for it.
  const [core] = useState(() =>
    createWizardAutosave<T>({
      initial,
      base: stableSnapshot(initial),
      debounceMs: DEBOUNCE_MS,
      onChange: (v) => setValuesState(v),
      write: (v, base) => {
        saveListingWizardDraft(draftKey, {
          [step]: { values: v, savedAt: Date.now(), base },
        });
      },
    }),
  );

  // Restore once on mount (client). localStorage only exists after mount.
  useEffect(() => {
    const base = stableSnapshot(initial);
    core.setBase(base);
    const blob = readStepBlob(loadListingWizardDraft(draftKey), step);
    const { values: next } = resolveWizardDraftValues(
      initial,
      blob,
      toMillis(serverUpdatedAt),
    );
    if (blob && typeof blob.base === "string" && blob.base === base) {
      core.setBase(blob.base);
    }
    // Text typed before the page finished loading wins over the draft.
    if (!core.hasEdits() && readLive) {
      const live = readLive();
      if (live && Object.keys(live).length > 0) {
        const merged = { ...initial, ...live } as T;
        if (stableSnapshot(merged) !== base) core.edit(merged);
      }
    }
    core.hydrate(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from an external store
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once per draft/step
  }, [draftKey, step]);

  const setValues = useCallback(
    (update: SetStateAction<T>) => {
      const prev = core.latest();
      const next =
        typeof update === "function" ? (update as (p: T) => T)(prev) : update;
      core.edit(next);
    },
    [core],
  );

  const flush = useCallback(() => core.flush(), [core]);
  const latest = useCallback(() => core.latest(), [core]);

  // Flush on reload / tab close / tab hidden, and on unmount.
  useEffect(() => {
    const onHide = () => core.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") core.flush();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      core.flush();
    };
  }, [core]);

  return { values, setValues, hydrated, flush, latest };
}
