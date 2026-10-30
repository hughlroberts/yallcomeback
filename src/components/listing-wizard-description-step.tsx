"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveListingDescription } from "@/app/actions/properties";
import { useListingWizardAutosave } from "@/lib/use-listing-wizard-autosave";
import { WizardMissingFields } from "@/components/wizard-missing-fields";

const MAX = 500;
const MIN = 20;

type Props = {
  propertyId: string;
  initialDescription: string;
  serverUpdatedAt?: string | Date | null;
};

type DescriptionFields = {
  description: string;
};

export function ListingWizardDescriptionStep({
  propertyId,
  initialDescription,
  serverUpdatedAt,
}: Props) {
  const draftKey = `property-${propertyId}`;
  const { values, setValues } = useListingWizardAutosave<DescriptionFields>({
    draftKey,
    step: "description",
    serverUpdatedAt,
    initial: { description: (initialDescription || "").slice(0, MAX) },
  });

  const description = values.description;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = useMemo(() => {
    const m: string[] = [];
    const len = description.trim().length;
    if (len < MIN) {
      m.push(
        len === 0
          ? "Description"
          : `Description (at least ${MIN} characters; ${MIN - len} more)`,
      );
    }
    return m;
  }, [description]);

  function onNext() {
    setError(null);
    const trimmed = description.trim();
    if (trimmed.length < MIN) {
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

  const nextDisabled = pending || missing.length > 0;

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
            onChange={(e) =>
              setValues({ description: e.target.value.slice(0, MAX) })
            }
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
        <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-4 sm:px-6">
          {nextDisabled && missing.length > 0 ? (
            <WizardMissingFields missing={missing} />
          ) : null}
          <div className="flex items-center justify-between">
            <Link
              href={`/admin/properties/${propertyId}/setup?step=6`}
              className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
            >
              {pending ? "Saving…" : "Next"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
