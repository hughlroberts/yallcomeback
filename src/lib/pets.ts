import { SEARCH_MAX_PETS } from "@/lib/search-filters";

/**
 * Pet fee and pet rules for listings.
 * Guest-facing copy should stay short (ASD-STE100 for help docs).
 */

export type PetFeeUnit = "PER_STAY" | "PER_PET";

export type PetPolicyInput = {
  petsAllowed: boolean;
  /** Fee amount; unit decides stay vs per pet */
  petFee: number;
  petFeeUnit?: PetFeeUnit | string | null;
  /**
   * Max pets/dogs allowed when pets are allowed.
   * 0 or null = no fixed cap (UI may still offer a practical range).
   */
  maxPets?: number | null;
};

/**
 * Global pets limit (T56: 4). A listing's maxPets of 0 ("no fixed cap") or
 * above 4 still means at most 4; a lower listing max wins.
 */
export const PET_SELECT_FALLBACK_MAX = SEARCH_MAX_PETS;

/**
 * Pets to carry into a listing / book link: only a count this listing can
 * take (1..effectiveMaxPets). Over the listing max, or any pets on a no-pets
 * listing, gives undefined so bookUrl never offers a stay the host refuses.
 */
export function petsForListingLink(
  policy: PetPolicyInput,
  pets: number | null | undefined,
): number | undefined {
  if (pets == null || !Number.isInteger(pets) || pets < 1) return undefined;
  return pets <= effectiveMaxPets(policy) ? pets : undefined;
}

export function normalizePetFeeUnit(
  unit: PetFeeUnit | string | null | undefined,
): PetFeeUnit {
  return unit === "PER_PET" ? "PER_PET" : "PER_STAY";
}

/** Max selectable pets for a listing (0 when pets are not allowed). */
export function effectiveMaxPets(policy: PetPolicyInput): number {
  if (!policy.petsAllowed) return 0;
  const cap = Math.floor(Number(policy.maxPets ?? 0));
  if (Number.isFinite(cap) && cap > 0) return Math.min(cap, PET_SELECT_FALLBACK_MAX);
  return PET_SELECT_FALLBACK_MAX;
}

/**
 * Validate pet count and compute total pet fee for a stay.
 */
export function resolvePetCharges(
  policy: PetPolicyInput,
  rawPets: number,
): {
  pets: number;
  petFee: number;
  unit: PetFeeUnit;
  error?: string;
} {
  const unit = normalizePetFeeUnit(policy.petFeeUnit);
  const pets = Math.max(0, Math.floor(rawPets || 0));
  const amount = Math.max(0, Number(policy.petFee) || 0);

  if (pets === 0) {
    return { pets: 0, petFee: 0, unit };
  }

  if (!policy.petsAllowed) {
    return {
      pets,
      petFee: 0,
      unit,
      error: "Pets are not allowed at this property",
    };
  }

  const max = effectiveMaxPets(policy);
  const configuredCap = Math.min(
    Math.floor(Number(policy.maxPets ?? 0)),
    PET_SELECT_FALLBACK_MAX,
  );
  if (Number.isFinite(configuredCap) && configuredCap > 0 && pets > configuredCap) {
    return {
      pets,
      petFee: 0,
      unit,
      error: `This listing allows a maximum of ${configuredCap} pet${configuredCap === 1 ? "" : "s"} (dogs)`,
    };
  }
  if (pets > max) {
    return {
      pets,
      petFee: 0,
      unit,
      error: `This listing allows a maximum of ${max} pet${max === 1 ? "" : "s"}`,
    };
  }

  const petFee =
    unit === "PER_PET"
      ? Math.round(amount * pets * 100) / 100
      : Math.round(amount * 100) / 100;

  return { pets, petFee, unit };
}

/** Short guest-facing fee unit label, e.g. "per stay" / "per pet". */
export function petFeeUnitLabel(unit: PetFeeUnit | string | null | undefined): string {
  return normalizePetFeeUnit(unit) === "PER_PET" ? "per pet" : "per stay";
}

/** e.g. "$50 per stay" or "$25 per pet". */
export function formatPetFeeRate(
  amount: number,
  unit: PetFeeUnit | string | null | undefined,
  formatMoney: (n: number) => string,
): string {
  if (!(amount > 0)) return "";
  return `${formatMoney(amount)} ${petFeeUnitLabel(unit)}`;
}

/** House-rules style line for Things to know. */
export function petRuleLine(policy: PetPolicyInput): string | null {
  if (policy.petsAllowed === false) return "No pets";
  if (!policy.petsAllowed) return null;
  const cap = Math.min(
    Math.floor(Number(policy.maxPets ?? 0)),
    PET_SELECT_FALLBACK_MAX,
  );
  if (Number.isFinite(cap) && cap > 0) {
    return `Pets allowed · max ${cap} dog${cap === 1 ? "" : "s"} / pet${cap === 1 ? "" : "s"}`;
  }
  return "Pets allowed";
}
