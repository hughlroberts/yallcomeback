"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui";
import { baseNightlyRateFieldError } from "@/lib/extra-guests";

/**
 * Listing-tab base nightly rate: inline error on change and blur (E1104-A1),
 * same $1 minimum as Calendar pricing / updatePropertyPricing.
 */
export function ListingBaseNightlyField({
  defaultValue,
}: {
  defaultValue: number;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const [badInput, setBadInput] = useState(false);
  const [touched, setTouched] = useState(false);
  const error =
    touched || badInput || value.trim() !== String(defaultValue)
      ? baseNightlyRateFieldError(value, badInput)
      : undefined;

  return (
    <div>
      <Label htmlFor="baseNightlyRate">Base nightly rate</Label>
      <Input
        id="baseNightlyRate"
        name="baseNightlyRate"
        type="number"
        min={1}
        step="0.01"
        required
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "baseNightlyRate-error" : undefined}
        className={error ? "border-red-500" : undefined}
        onChange={(e) => {
          setTouched(true);
          setValue(e.target.value);
          setBadInput(e.target.validity.badInput);
        }}
        onBlur={(e) => {
          setTouched(true);
          setBadInput(e.target.validity.badInput);
        }}
      />
      {error ? (
        <p
          id="baseNightlyRate-error"
          role="alert"
          className="mt-1 text-xs text-red-600"
        >
          {error}
        </p>
      ) : (
        <p className="mt-1 text-xs text-stone-400">Per night · at least $1</p>
      )}
    </div>
  );
}
