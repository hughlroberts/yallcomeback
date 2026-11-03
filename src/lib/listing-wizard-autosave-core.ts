/**
 * Framework-free core of the listing-wizard autosave.
 *
 * Rules (local text is the source of truth while the host types):
 * - Every edit replaces the local value at once; nothing written back from
 *   storage or the server may replace it later.
 * - The debounced save always sends the latest local value.
 * - A late restore (draft read after the host already typed) is ignored.
 * - A slow save that finishes after newer edits never changes local text,
 *   and the newer text is saved next.
 * - flush() saves exactly the current local value at once (blur, step
 *   change, submit, page hide).
 */
/** `base` is the server snapshot the draft was started from. */
export type AutosaveWrite<T> = (
  values: T,
  base: string | undefined,
) => void | Promise<unknown>;

export type AutosaveTimers = {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const defaultTimers: AutosaveTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function createWizardAutosave<T>(opts: {
  initial: T;
  base?: string;
  write: AutosaveWrite<T>;
  debounceMs?: number;
  timers?: AutosaveTimers;
  /** Called whenever the local value changes (React setState). */
  onChange?: (values: T) => void;
}) {
  const debounceMs = opts.debounceMs ?? 300;
  const timers = opts.timers ?? defaultTimers;
  let latest = opts.initial;
  let base = opts.base;
  let edited = false;
  let hydrated = false;
  let dirty = false;
  let timer: unknown = null;
  let editSeq = 0;
  let savedSeq = 0;
  let inFlight: Promise<unknown> | null = null;

  function clearTimer() {
    if (timer != null) {
      timers.clear(timer);
      timer = null;
    }
  }

  function flush(): void {
    clearTimer();
    if (!dirty || !hydrated) return;
    dirty = false;
    const seq = editSeq;
    const sent = latest;
    const r = opts.write(sent, base);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      const p = (r as Promise<unknown>).then(
        () => {
          // Ignore results of older saves; never touch local text.
          if (seq > savedSeq) savedSeq = seq;
        },
        () => {
          // Failed save: keep the text local and try again on next flush.
          if (seq === editSeq) dirty = true;
        },
      );
      inFlight = p.finally(() => {
        if (inFlight === p) inFlight = null;
      });
    } else {
      savedSeq = seq;
    }
  }

  return {
    latest: () => latest,
    setBase(next: string) {
      base = next;
    },
    hasEdits: () => edited,
    isHydrated: () => hydrated,
    savedSeq: () => savedSeq,
    editSeq: () => editSeq,
    pending: () => inFlight,
    edit(next: T) {
      latest = next;
      edited = true;
      editSeq += 1;
      dirty = true;
      opts.onChange?.(latest);
      if (!hydrated) return;
      clearTimer();
      timer = timers.set(flush, debounceMs);
    },
    /**
     * Apply the restored value once on mount. If the host already typed,
     * keep the typed text and save it instead.
     */
    hydrate(restored: T): T {
      if (hydrated) return latest;
      hydrated = true;
      if (edited) {
        clearTimer();
        timer = timers.set(flush, debounceMs);
        return latest;
      }
      latest = restored;
      opts.onChange?.(latest);
      return latest;
    },
    flush,
    dispose() {
      flush();
      clearTimer();
    },
  };
}
