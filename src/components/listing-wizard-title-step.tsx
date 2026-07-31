"use client";

import { useState, useTransition } from "react";
import { saveListingTitle } from "@/app/actions/properties";

const MAX = 50;

type Props = {
  propertyId: string;
  placeWord: string;
  initialTitle: string;
};

export function ListingWizardTitleStep({
  propertyId,
  placeWord,
  initialTitle,
}: Props) {
  const starter =
    initialTitle === "Untitled listing" ? "" : initialTitle.slice(0, MAX);
  const [title, setTitle] = useState(starter);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onNext() {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Add a title to continue");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("title", trimmed);
        await saveListingTitle(fd);
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
          Now, let&apos;s give your {placeWord.toLowerCase()} a title
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-stone-500">
          Short titles work best. Have fun with it - you can always change it
          later.
        </p>

        <div className="mt-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, MAX))}
            maxLength={MAX}
            placeholder="Cozy lakefront cabin"
            className="w-full rounded-xl border border-stone-300 px-4 py-4 text-center text-lg text-stone-900 outline-none focus:border-stone-900"
            autoFocus
          />
          <p className="mt-2 text-sm text-stone-500">
            {title.length}/{MAX}
          </p>
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[80%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4 sm:px-6">
          <a
            href={`/admin/properties/${propertyId}/setup?step=5`}
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </a>
          <button
            type="button"
            onClick={onNext}
            disabled={pending || !title.trim()}
            className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
          >
            {pending ? "Saving…" : "Next"}
          </button>
        </div>
      </footer>
    </div>
  );
}
