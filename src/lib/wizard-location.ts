/** Pure rules for the listing wizard location step (step 3). */

export type WizardLocationValues = {
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  showPrecise: boolean;
  /** Last lookup failed and the host has not resolved it yet. */
  addressUnresolved?: boolean;
};

export const UNRESOLVED_ADDRESS_MESSAGE =
  "Map pin (find the address, enter coordinates, or choose Continue anyway)";

/** A failed lookup drops the old pin so a stale location is never saved. */
export function locationAfterLookupFailure<T extends WizardLocationValues>(
  values: T,
): T {
  return { ...values, lat: null, lng: null, addressUnresolved: true };
}

/** A found address or applied coordinates resolve the step. */
export function locationAfterPin<T extends WizardLocationValues>(
  values: T,
  lat: number,
  lng: number,
): T {
  return { ...values, lat, lng, addressUnresolved: false };
}

/** Host chose to go on without a pin. */
export function locationContinueAnyway<T extends WizardLocationValues>(
  values: T,
): T {
  return { ...values, lat: null, lng: null, addressUnresolved: false };
}

/** What still blocks Next on the pin screen. Empty means Next is allowed. */
export function locationMissingFields(values: WizardLocationValues): string[] {
  const missing: string[] = [];
  if (!values.address.trim() && !values.city.trim()) {
    missing.push("Street address or city");
  }
  if (values.addressUnresolved) missing.push(UNRESOLVED_ADDRESS_MESSAGE);
  return missing;
}

/** Parse manual coordinates; returns an error message or the numbers. */
export function parseManualCoords(
  latRaw: string,
  lngRaw: string,
): { lat: number; lng: number } | { error: string } {
  if (!latRaw.trim() || !lngRaw.trim()) {
    return { error: "Enter both latitude and longitude" };
  }
  const la = Number(latRaw);
  const ln = Number(lngRaw);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    return { error: "Enter numeric latitude and longitude" };
  }
  if (la < -90 || la > 90 || ln < -180 || ln > 180) {
    return { error: "Latitude must be −90…90 and longitude −180…180" };
  }
  return { lat: Number(la.toFixed(6)), lng: Number(ln.toFixed(6)) };
}
