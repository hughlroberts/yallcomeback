"use client";

import { useState, useTransition } from "react";
import { LISTING_TYPES, type ListingTypeId } from "@/lib/listing-types";
import { startListingDraft } from "@/app/actions/properties";

type Props = {
  hostId?: string;
  hosts?: { id: string; name: string }[];
};

export function ListingWizardTypeStep({ hostId, hosts = [] }: Props) {
  const [selected, setSelected] = useState<ListingTypeId | null>(null);
  const [chosenHostId, setChosenHostId] = useState(hostId || hosts[0]?.id || "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onNext() {
    setError(null);
    if (!selected) {
      setError("Pick a place type to continue");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("propertyType", selected);
        if (chosenHostId) fd.set("hostId", chosenHostId);
        await startListingDraft(fd);
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
        <div className="flex items-center gap-2">
          <a
            href="/admin/properties"
            className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
          >
            Save & exit
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Which of these best describes your place?
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-stone-500">
          You can change details later. Just pick the closest match.
        </p>

        {hosts.length > 1 ? (
          <div className="mx-auto mt-8 max-w-sm">
            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Host
            </label>
            <select
              value={chosenHostId}
              onChange={(e) => setChosenHostId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm"
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LISTING_TYPES.map((type) => {
            const active = selected === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelected(type.id)}
                className={[
                  "flex flex-col items-start gap-3 rounded-xl border-2 p-4 text-left transition",
                  active
                    ? "border-stone-900 bg-stone-50 shadow-sm"
                    : "border-stone-200 bg-white hover:border-stone-400",
                ].join(" ")}
              >
                <span className="text-2xl" aria-hidden>
                  {type.icon}
                </span>
                <span className="text-sm font-semibold text-stone-900">
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[12%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href="/admin/properties"
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </a>
          <button
            type="button"
            onClick={onNext}
            disabled={pending || !selected}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
          >
            {pending ? "Starting…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
