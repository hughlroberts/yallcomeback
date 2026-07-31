/**
 * Bitcoin deposit payments for booking holds.
 *
 * Configure in .env:
 *   BITCOIN_ENABLED=true
 *   BITCOIN_ADDRESS=bc1q…   (or 1… / 3… legacy)
 *   BITCOIN_NETWORK=mainnet  (optional label)
 *   BITCOIN_LABEL=Yall Come Back deposits  (optional BIP21 label)
 *
 * Guests pay the USD deposit equivalent in BTC. Hosts confirm receipt in admin
 * (paste tx id). No third-party processor required - works for self-hosts.
 */

const ADDRESS_RE =
  /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|tb1[a-z0-9]{25,87})$/;

export function isBitcoinEnabled(): boolean {
  if (process.env.BITCOIN_ENABLED !== "true") return false;
  return Boolean(getBitcoinAddress());
}

export function getBitcoinAddress(): string | null {
  const addr = (process.env.BITCOIN_ADDRESS || "").trim();
  if (!addr) return null;
  if (!ADDRESS_RE.test(addr)) return null;
  return addr;
}

export function getBitcoinNetworkLabel(): string {
  const n = (process.env.BITCOIN_NETWORK || "mainnet").trim().toLowerCase();
  return n === "testnet" ? "Bitcoin testnet" : "Bitcoin";
}

export function getBitcoinLabel(): string {
  return (
    process.env.BITCOIN_LABEL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_NAME?.trim() ||
    "Yall Come Back deposit"
  );
}

export function formatBtc(amount: number, maxFrac = 8): string {
  if (!Number.isFinite(amount) || amount <= 0) return " - ";
  // Trim trailing zeros but keep enough precision for on-chain amounts
  const s = amount.toFixed(maxFrac).replace(/\.?0+$/, "");
  return `${s} BTC`;
}

/** BIP21 payment URI for wallets */
export function bitcoinPaymentUri(opts: {
  address: string;
  amountBtc?: number | null;
  label?: string;
  message?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.amountBtc != null && opts.amountBtc > 0) {
    // BIP21 uses BTC as unit with up to 8 decimal places
    params.set("amount", opts.amountBtc.toFixed(8).replace(/\.?0+$/, ""));
  }
  if (opts.label) params.set("label", opts.label);
  if (opts.message) params.set("message", opts.message);
  const q = params.toString();
  return q ? `bitcoin:${opts.address}?${q}` : `bitcoin:${opts.address}`;
}

export type BtcQuote = {
  usdAmount: number;
  btcAmount: number;
  rateUsdPerBtc: number;
  fetchedAt: Date;
};

/**
 * Convert a USD deposit to BTC using a public spot rate.
 * Falls back to null if the rate cannot be fetched (guest still pays USD-equivalent).
 */
export async function quoteBtcFromUsd(
  usdAmount: number,
): Promise<BtcQuote | null> {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return null;

  const rate = await fetchUsdPerBtc();
  if (!rate || rate <= 0) return null;

  // Round up slightly so underpayment from rate drift is less likely
  const raw = usdAmount / rate;
  const btcAmount = Math.ceil(raw * 1e8) / 1e8; // satoshi precision, round up

  return {
    usdAmount,
    btcAmount,
    rateUsdPerBtc: rate,
    fetchedAt: new Date(),
  };
}

async function fetchUsdPerBtc(): Promise<number | null> {
  // Coinbase public rates (no API key)
  try {
    const res = await fetch(
      "https://api.coinbase.com/v2/exchange-rates?currency=BTC",
      { next: { revalidate: 120 } },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        data?: { rates?: { USD?: string } };
      };
      const n = Number(data.data?.rates?.USD);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* try fallback */
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { next: { revalidate: 120 } },
    );
    if (res.ok) {
      const data = (await res.json()) as { bitcoin?: { usd?: number } };
      const n = Number(data.bitcoin?.usd);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function bitcoinSetupLabel(): string {
  if (process.env.BITCOIN_ENABLED !== "true") {
    return "Off - set BITCOIN_ENABLED=true and BITCOIN_ADDRESS";
  }
  if (!getBitcoinAddress()) {
    return "Enabled but address missing or invalid";
  }
  return `On · ${getBitcoinNetworkLabel()} · ${getBitcoinAddress()!.slice(0, 8)}…`;
}
