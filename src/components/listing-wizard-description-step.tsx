"use client";

import { useState, useTransition } from "react";
import { saveListingDescription } from "@/app/actions/properties";

const MAX = 500;

type Props = {
  propertyId: string;
  initialDescription: string;
};

export function ListingWizardDescriptionStep({
  propertyId,
  initialDescription,
}: Props) {
  const [description, setDescription] = useState(
    (initialDescription || "").slice(0, MAX),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onNext() {
    setError(null);
    const trimmed = description.trim();
    if (trimmed.length < 20) {
      setError("Write a little more so guests know what to expect");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("description", trimmed);
        await saveListingDescription(fd);
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

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Create your description
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-stone-500">
          Share what makes your place special. You can edit this anytime.
        </p>

        <div className="mt-10">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX))}
            maxLength={MAX}
            rows={8}
            placeholder="Peaceful lake views, a full kitchen, and room for the whole family…"
            className="w-full resize-none rounded-xl border border-stone-300 px-4 py-4 text-base text-stone-900 outline-none focus:border-stone-900"
            autoFocus
          />
          <p className="mt-2 text-sm text-stone-500">
            {description.length}/{MAX}
          </p>
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[88%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={`/admin/properties/${propertyId}/setup?step=6`}
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </a>
          <button
            type="button"
            onClick={onNext}
            disabled={pending || description.trim().length < 20}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
