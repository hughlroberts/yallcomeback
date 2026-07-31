"use client";

import { useState, useTransition } from "react";
import {
  AMENITY_GROUPS,
  type AmenityOption,
} from "@/lib/listing-amenities";
import { saveListingAmenities } from "@/app/actions/properties";

type Props = {
  propertyId: string;
  initialIds: string[];
};

function AmenityCard({
  option,
  selected,
  onToggle,
}: {
  option: AmenityOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition",
        selected
          ? "border-stone-900 bg-stone-50"
          : "border-stone-200 bg-white hover:border-stone-400",
      ].join(" ")}
    >
      <span className="text-2xl" aria-hidden>
        {option.icon}
      </span>
      <span className="text-sm font-semibold text-stone-900">{option.label}</span>
      {option.description ? (
        <span className="text-xs text-stone-500">{option.description}</span>
      ) : null}
    </button>
  );
}

export function ListingWizardAmenitiesStep({
  propertyId,
  initialIds,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onNext() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("amenityIds", [...selected].join(","));
        await saveListingAmenities(fd);
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

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Tell guests which amenities they&apos;ll find at your place
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          You can add more after you publish.
        </p>

        {AMENITY_GROUPS.map((group) => (
          <section key={group.id} className="mt-10">
            <h2 className="text-lg font-semibold text-stone-900">
              {group.title}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {group.options.map((option) => (
                <AmenityCard
                  key={option.id}
                  option={option}
                  selected={selected.has(option.id)}
                  onToggle={() => toggle(option.id)}
                />
              ))}
            </div>
          </section>
        ))}

        {error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[72%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={`/admin/properties/${propertyId}/setup?step=4`}
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
