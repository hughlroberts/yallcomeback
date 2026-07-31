"use client";

import { useState, useTransition } from "react";
import { saveListingBasics } from "@/app/actions/properties";

type Props = {
  propertyId: string;
  initial: {
    maxGuests: number;
    bedrooms: number;
    beds: number;
    bathrooms: number;
  };
};

function StepperRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-stone-200 py-5 first:pt-0 last:border-b-0">
      <span className="text-base text-stone-900">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, Number((value - step).toFixed(1))))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-lg text-stone-700 hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <span className="w-8 text-center text-base tabular-nums text-stone-900">
          {value}
        </span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, Number((value + step).toFixed(1))))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-lg text-stone-700 hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ListingWizardBasicsStep({ propertyId, initial }: Props) {
  const [guests, setGuests] = useState(initial.maxGuests || 2);
  const [bedrooms, setBedrooms] = useState(initial.bedrooms || 1);
  const [beds, setBeds] = useState(initial.beds || 1);
  const [bathrooms, setBathrooms] = useState(initial.bathrooms || 1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onNext() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("maxGuests", String(guests));
        fd.set("bedrooms", String(bedrooms));
        fd.set("beds", String(beds));
        fd.set("bathrooms", String(bathrooms));
        await saveListingBasics(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonnet text-sm font-bold text-white">
          S
        </span>
        <a
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Save & exit
        </a>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Share some basics about your place
        </h1>
        <p className="mt-2 text-center text-sm text-stone-500">
          You&apos;ll add more details later, like bed types.
        </p>

        <div className="mt-10">
          <StepperRow
            label="Guests"
            value={guests}
            min={1}
            max={30}
            onChange={setGuests}
          />
          <StepperRow
            label="Bedrooms"
            value={bedrooms}
            min={0}
            max={20}
            onChange={setBedrooms}
          />
          <StepperRow
            label="Beds"
            value={beds}
            min={1}
            max={30}
            onChange={setBeds}
          />
          <StepperRow
            label="Bathrooms"
            value={bathrooms}
            min={0}
            max={20}
            step={0.5}
            onChange={setBathrooms}
          />
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[60%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={`/admin/properties/${propertyId}/setup?step=3`}
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </a>
          <button
            type="button"
            onClick={onNext}
            disabled={pending}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:bg-lupine/40"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
