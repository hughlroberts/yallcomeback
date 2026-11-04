import { retrieveConnectStatus } from "@/lib/stripe-connect";

/**
 * T61: live gate for taking a guest card deposit on a brand's OWN Stripe
 * Connect account. Reads the account from Stripe (never a DB status cache).
 * Only a READY result is cached, for a short time; anything not ready or
 * any Stripe error is re-checked on every call. Never creates a charge.
 */
export type ConnectGateCode =
  | "connect_no_account"
  | "connect_details_not_submitted"
  | "connect_charges_not_enabled"
  | "connect_status_unavailable";

export type ConnectGateResult =
  | { ok: true; accountId: string }
  | { ok: false; status: 409 | 503; code: ConnectGateCode; error: string };

export const CONNECT_READY_CACHE_MS = 60_000;
const PAYMENTS_PATH = "/admin/payments";

export const CONNECT_GATE_MESSAGES: Record<ConnectGateCode, string> = {
  connect_no_account: `This listing is not ready to take a card deposit: the host has not set up Stripe card payments for this brand. The host can fix this at ${PAYMENTS_PATH}.`,
  connect_details_not_submitted: `This listing is not ready to take a card deposit: the host has not finished Stripe onboarding (details not submitted). The host can finish it at ${PAYMENTS_PATH}.`,
  connect_charges_not_enabled: `This listing is not ready to take a card deposit: Stripe has not enabled card charges on the host's account yet. The host can check ${PAYMENTS_PATH}.`,
  connect_status_unavailable:
    "Card deposits are temporarily unavailable: could not confirm the host's Stripe account status. Try again in a few minutes.",
};

const readyCache = new Map<string, number>();

export function clearConnectReadyCache() {
  readyCache.clear();
}

function fail(code: ConnectGateCode): ConnectGateResult {
  return {
    ok: false,
    status: code === "connect_status_unavailable" ? 503 : 409,
    code,
    error: CONNECT_GATE_MESSAGES[code],
  };
}

export async function checkBrandConnectReady(
  host: { stripeAccountId?: string | null },
  nowMs: number = Date.now(),
): Promise<ConnectGateResult> {
  const accountId = host.stripeAccountId?.trim();
  if (!accountId) return fail("connect_no_account");

  const cachedUntil = readyCache.get(accountId);
  if (cachedUntil && cachedUntil > nowMs) return { ok: true, accountId };
  readyCache.delete(accountId);

  let status: Awaited<ReturnType<typeof retrieveConnectStatus>>;
  try {
    status = await retrieveConnectStatus(accountId);
  } catch (e) {
    console.error(
      "[connect-readiness] Stripe account status unavailable:",
      e instanceof Error ? e.message.slice(0, 200) : "unknown error",
    );
    return fail("connect_status_unavailable");
  }
  // details_submitted ≈ onboarding requirements met; charges_enabled ≈ card_payments active.
  if (!status.onboardingComplete) return fail("connect_details_not_submitted");
  if (!status.readyToProcessPayments) return fail("connect_charges_not_enabled");

  readyCache.set(accountId, nowMs + CONNECT_READY_CACHE_MS);
  return { ok: true, accountId };
}
