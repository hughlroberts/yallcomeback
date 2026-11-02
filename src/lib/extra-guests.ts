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
  // Guests beyond the included count, whether or not a fee applies (a $0 fee
  // still has extra guests; it just charges nothing for them).
  const extraGuests = Math.max(0, g - included);
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

/**
 * Validate the host's extra-guest settings. Returns an error message, or
 * null when valid. Fee: 0 or more. Included: whole number, 1 to maxGuests.
 * A null value means "not sent" and is not checked.
 */
export function extraGuestSettingsError(input: {
  extraGuestFee: number | null;
  extraGuestsIncluded: number | null;
  maxGuests: number;
}): string | null {
  const { extraGuestFee: fee, extraGuestsIncluded: included } = input;
  if (fee != null && (!Number.isFinite(fee) || fee < 0)) {
    return "Extra guest fee must be 0 or more";
  }
  const max = Math.max(1, Math.floor(input.maxGuests) || 1);
  if (
    included != null &&
    (!Number.isInteger(included) || included < 1 || included > max)
  ) {
    return `Guests in base price must be a whole number from 1 to ${max} (the listing max)`;
  }
  return null;
}

export type ExtraGuestFieldErrors = {
  extraGuestFee?: string;
  extraGuestsIncluded?: string;
};

/** Plain decimal, optional minus sign: "10", "10.5", ".5", "-3". No "1e2" or "0x1". */
const PLAIN_NUMBER = /^-?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Check the two extra-guest inputs as typed (strings), for the inline errors
 * in the listing form and for the server save. A null value means the form
 * did not send that field (it is not checked). `badInput` is the browser's
 * flag for text a number input cannot read (for example "abc" or "1e").
 * Fee: empty means $0. Included: required, whole number, 1 to maxGuests.
 */
export function extraGuestFieldErrors(input: {
  extraGuestFee: string | null;
  extraGuestsIncluded: string | null;
  maxGuests: number;
  feeBadInput?: boolean;
  includedBadInput?: boolean;
}): ExtraGuestFieldErrors {
  const errors: ExtraGuestFieldErrors = {};
  const max = Math.max(1, Math.floor(input.maxGuests) || 1);

  if (input.extraGuestFee != null || input.feeBadInput) {
    const fee = (input.extraGuestFee ?? "").trim();
    if (input.feeBadInput || (fee !== "" && !PLAIN_NUMBER.test(fee))) {
      errors.extraGuestFee = "Extra guest fee must be a number, for example 10";
    } else if (fee !== "" && Number(fee) < 0) {
      errors.extraGuestFee = "Extra guest fee must be 0 or more";
    }
  }

  if (input.extraGuestsIncluded != null || input.includedBadInput) {
    const inc = (input.extraGuestsIncluded ?? "").trim();
    if (input.includedBadInput || (inc !== "" && !PLAIN_NUMBER.test(inc))) {
      errors.extraGuestsIncluded = "Guests in base price must be a number";
    } else if (inc === "") {
      errors.extraGuestsIncluded = "Enter how many guests the base price covers";
    } else {
      const n = Number(inc);
      if (n < 0) {
        errors.extraGuestsIncluded = "Guests in base price must be 1 or more";
      } else if (!Number.isInteger(n) || n < 1 || n > max) {
        errors.extraGuestsIncluded = `Guests in base price must be a whole number from 1 to ${max} (the listing max)`;
      }
    }
  }
  return errors;
}
