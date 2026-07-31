"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { SPACE_TYPES, type SpaceTypeId } from "@/lib/listing-types";
import { saveListingSpaceType } from "@/app/actions/properties";

type Props = {
  propertyId: string;
  initialSpaceType?: SpaceTypeId | null;
};

export function ListingWizardSpaceStep({
  propertyId,
  initialSpaceType,
}: Props) {
  const [selected, setSelected] = useState<SpaceTypeId | null>(
    initialSpaceType && SPACE_TYPES.some((t) => t.id === initialSpaceType)
      ? initialSpaceType
      : "entire_place",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onNext() {
    setError(null);
    if (!selected) {
      setError("Pick one to continue");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("spaceType", selected);
        await saveListingSpaceType(fd);
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
        <Link
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Save & exit
        </Link>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          What type of place will guests have?
        </h1>

        <div className="mt-10 space-y-3">
          {SPACE_TYPES.map((type) => {
            const active = selected === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelected(type.id)}
                className={[
                  "flex w-full items-center justify-between gap-4 rounded-xl border-2 px-5 py-5 text-left transition",
                  active
                    ? "border-stone-900 bg-stone-50"
                    : "border-stone-200 bg-white hover:border-stone-400",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="text-base font-semibold text-stone-900">
                    {type.label}
                  </div>
                  <p className="mt-1 text-sm text-stone-500">
                    {type.description}
                  </p>
                </div>
                <span className="shrink-0 text-3xl" aria-hidden>
                  {type.icon}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[24%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/admin/properties"
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={onNext}
            disabled={pending || !selected}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
