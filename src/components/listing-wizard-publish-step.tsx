"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { publishListing } from "@/app/actions/properties";

type Props = {
  propertyId: string;
  title: string;
  baseNightlyRate: number;
  discountNewListingPercent: number;
  coverImageUrl: string | null;
  previewHref: string;
  editorHref: string;
  calendarHref: string;
};

export function ListingWizardPublishStep({
  propertyId,
  title,
  baseNightlyRate,
  discountNewListingPercent,
  coverImageUrl,
  previewHref,
  editorHref,
  calendarHref,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const promo =
    discountNewListingPercent > 0
      ? Math.round(
          baseNightlyRate * (1 - discountNewListingPercent / 100) * 100,
        ) / 100
      : null;

  function onPublish() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        await publishListing(fd);
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Yay! It&apos;s time to publish.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-stone-500">
          Here&apos;s what we&apos;ll show to guests. Before you publish, make
          sure to review the details.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
          {/* Preview card */}
          <div>
            <Link
              href={previewHref}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative aspect-[4/3] bg-stone-100">
                {coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-stone-400">
                    Add photos in the editor
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-stone-800 shadow-sm">
                  Show preview
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-stone-900">
                    {title}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {promo != null ? (
                      <>
                        <span className="text-stone-400 line-through">
                          ${baseNightlyRate}
                        </span>{" "}
                        <span className="font-semibold text-stone-900">
                          ${promo}
                        </span>
                      </>
                    ) : (
                      <span className="font-semibold text-stone-900">
                        ${baseNightlyRate}
                      </span>
                    )}{" "}
                    <span className="font-normal text-stone-500">night</span>
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-bonnet px-2.5 py-1 text-xs font-semibold text-white">
                  New ★
                </span>
              </div>
            </Link>
          </div>

          {/* What's next */}
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              What&apos;s next?
            </h2>
            <ul className="mt-6 space-y-6">
              <li className="flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg"
                  aria-hidden
                >
                  📅
                </span>
                <div>
                  <p className="font-semibold text-stone-900">
                    Set up your calendar
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Choose which dates are available. Guests can book as soon as
                    you publish.
                  </p>
                  <Link
                    href={calendarHref}
                    className="mt-1 inline-block text-sm font-medium text-stone-800 underline-offset-2 hover:underline"
                  >
                    Open calendar →
                  </Link>
                </div>
              </li>
              <li className="flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg"
                  aria-hidden
                >
                  ✏️
                </span>
                <div>
                  <p className="font-semibold text-stone-900">
                    Adjust your settings
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    House rules, fees, photos, and how guests book - all in the
                    full editor.
                  </p>
                  <Link
                    href={editorHref}
                    className="mt-1 inline-block text-sm font-medium text-stone-800 underline-offset-2 hover:underline"
                  >
                    Open editor →
                  </Link>
                </div>
              </li>
              <li className="flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg"
                  aria-hidden
                >
                  👋
                </span>
                <div>
                  <p className="font-semibold text-stone-900">
                    Prepare for your first guest
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Double-check amenities, check-in times, and your host
                    messages before bookings start coming in.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {error ? (
          <p className="mt-8 text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-full bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={`/admin/properties/${propertyId}/setup?step=9`}
            className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={onPublish}
            disabled={pending}
            className="rounded-lg bg-bonnet px-8 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            {pending ? "Publishing…" : "Publish"}
          </button>
        </div>
      </footer>
    </div>
  );
}
