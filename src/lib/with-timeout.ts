/** Render-time Stripe lookups (card label) wait at most this long. */
export const CARD_LOOKUP_TIMEOUT_MS = 4_000;

/**
 * Resolve with `work`, or with null after `ms`. The work keeps running in the
 * background; its later result or error is ignored.
 */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  const guarded = work.catch(() => null);
  return Promise.race([guarded, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
