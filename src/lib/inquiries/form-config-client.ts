/**
 * Browser side of the "Message host" form config (fill-time stamp + optional
 * Turnstile site key from /api/inquiries/form-config). Kept free of React so
 * the timeout / fallback rules are unit-tested.
 *
 * The Send button never waits on this request: it shows "Send message" right
 * away, and if the stamp hasn't arrived (slow, 5xx during a deploy swap, or a
 * request that never answers) the submit fetches one itself, so the dialog
 * can't get stuck on "Loading…".
 */
import { MIN_FILL_MS, STAMP_FIELD } from "@/lib/inquiries/fields";

export const FORM_CONFIG_PATH = "/api/inquiries/form-config";
/** Give up on a config request after this long (then retry on submit). */
export const FORM_CONFIG_TIMEOUT_MS = 5_000;

export type InquiryFormConfig = {
  stamp: string;
  turnstileSiteKey: string | null;
  /** Client clock (ms) when the stamp arrived; for the fill-time wait. */
  receivedAt: number;
};

type FetchLike = (
  input: string,
  init?: { cache?: RequestCache; signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * Fetch a fresh config. Resolves to null (never rejects, never hangs past
 * `timeoutMs`) on a network error, non-2xx, bad JSON, or a missing stamp.
 */
export async function fetchInquiryFormConfig({
  fetchImpl = fetch as unknown as FetchLike,
  timeoutMs = FORM_CONFIG_TIMEOUT_MS,
  now = () => Date.now(),
}: {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  now?: () => number;
} = {}): Promise<InquiryFormConfig | null> {
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve(null);
    }, timeoutMs);
  });
  const request = (async () => {
    try {
      const res = await fetchImpl(FORM_CONFIG_PATH, {
        cache: "no-store",
        signal: controller?.signal,
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        stamp?: unknown;
        turnstileSiteKey?: unknown;
      } | null;
      if (!body || typeof body.stamp !== "string" || !body.stamp) return null;
      return {
        stamp: body.stamp,
        turnstileSiteKey:
          typeof body.turnstileSiteKey === "string" && body.turnstileSiteKey
            ? body.turnstileSiteKey
            : null,
        receivedAt: now(),
      };
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** How long to wait before sending so a just-issued stamp isn't "too fast". */
export function msUntilFillAllowed(receivedAt: number, now: number): number {
  return Math.max(0, receivedAt + MIN_FILL_MS + 250 - now);
}

export const FORM_CONFIG_UNREACHABLE =
  "We couldn't reach Yall Come Back to send this. Check your connection and try again.";

/**
 * Make sure the form data carries a stamp before the server action runs.
 * `ensureConfig` returns the config already loaded, waits for the one in
 * flight, or fetches a new one. Returns an error message when none could be
 * had (the server action is then skipped).
 */
export async function prepareInquirySubmit(
  formData: FormData,
  {
    ensureConfig,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = () => Date.now(),
  }: {
    ensureConfig: () => Promise<InquiryFormConfig | null>;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (String(formData.get(STAMP_FIELD) || "")) return { ok: true };
  const config = await ensureConfig();
  if (!config) return { ok: false, error: FORM_CONFIG_UNREACHABLE };
  formData.set(STAMP_FIELD, config.stamp);
  const wait = msUntilFillAllowed(config.receivedAt, now());
  if (wait > 0) await sleep(wait);
  return { ok: true };
}
