/**
 * Per-night charge for guests beyond the number the base rate covers
 * (e.g. "$75 for 2 guests, $10 per night for each additional guest").
 * Shared by the listing widget quote and the /book server quote so both
 * show the same numbers.
 */
export type ExtraGuestPolicy = {
  /** Charge per extra guest per night; 0 = no extra-guest charge. */
  extraGuestFee?: number | null;
  /** Guests the base nightly rate covers. */
  extraGuestsIncluded?: number | null;
};

export function extraGuestCharge(
  policy: ExtraGuestPolicy,
  guests: number,
  nights: number,
): { extraGuests: number; perGuestPerNight: number; total: number } {
  const fee = Math.max(0, Number(policy.extraGuestFee) || 0);
  const included = Math.max(
    1,
    Math.floor(Number(policy.extraGuestsIncluded) || 2),
  );
  const g = Math.max(0, Math.floor(Number(guests) || 0));
  const n = Math.max(0, Math.floor(Number(nights) || 0));
  const extraGuests = fee > 0 ? Math.max(0, g - included) : 0;
  return {
    extraGuests,
    perGuestPerNight: fee,
    total: Math.round(extraGuests * fee * n * 100) / 100,
  };
}

/**
 * Clamp a requested guest count to the listing max. `clamped` is true when
 * the request asked for more (or fewer) guests than the listing allows.
 */
export function clampGuests(
  requested: string | number | null | undefined,
  maxGuests: number,
): { guests: number; requested: number; clamped: boolean } {
  const max = Math.max(1, Math.floor(maxGuests) || 1);
  const raw = Math.floor(Number(requested ?? 1));
  const asked = Number.isFinite(raw) && raw >= 1 ? raw : 1;
  const guests = Math.min(max, asked);
  return { guests, requested: asked, clamped: guests !== asked };
}
