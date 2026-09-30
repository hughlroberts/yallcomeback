"use client";

import type { PaymentMethod } from "@prisma/client";
import { WEBSITE_PAY_CHOICES } from "@/lib/host-payments";

export function ListingPaymentMethodFields({
  defaultValue = "STRIPE",
  name = "websitePaymentMethod",
  value,
  onChange,
}: {
  defaultValue?: PaymentMethod | string;
  name?: string;
  value?: PaymentMethod | string;
  onChange?: (value: PaymentMethod) => void;
}) {
  const selected = value ?? defaultValue ?? "STRIPE";
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-stone-800">
        How guests pay the deposit on this listing
      </legend>
      <p className="text-xs text-stone-500">
        Find a Place (marketplace) always uses online card. This is for your
        website and direct booking links.
      </p>
      {WEBSITE_PAY_CHOICES.map((choice) => (
        <label
          key={choice.value}
          className="flex cursor-pointer items-start gap-2 text-sm"
        >
          <input
            type="radio"
            name={name}
            value={choice.value}
            required
            checked={onChange ? selected === choice.value : undefined}
            defaultChecked={onChange ? undefined : selected === choice.value}
            onChange={
              onChange
                ? () => onChange(choice.value)
                : undefined
            }
            className="mt-1"
          />
          <span>
            <span className="font-medium text-stone-900">{choice.label}</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              {choice.hint}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
