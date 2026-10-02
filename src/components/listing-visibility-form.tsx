"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateListingVisibility } from "@/app/actions/properties";
import {
  type ListingVisibility,
  visibilityFromFlags,
} from "@/lib/listing-visibility";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: ListingVisibility;
  label: string;
  hint: string;
}[] = [
  {
    value: "off",
    label: "Off — not taking bookings",
    hint: "Guests cannot book on your website or on Find a Place. Calendar and past stays stay here.",
  },
  {
    value: "website",
    label: "On — your website only",
    hint: "Bookable on your host site. Hidden from Find a Place (the Yall Come Back marketplace).",
  },
  {
    value: "both",
    label: "On — website + Find a Place",
    hint: "Bookable on your site and on yallcomeback.app Find a Place.",
  },
];

export function ListingVisibilityForm({
  propertyId,
  published,
  listOnMarketplace,
  compact = false,
  hostMarketplaceOn = true,
}: {
  propertyId: string;
  published: boolean;
  listOnMarketplace: boolean;
  compact?: boolean;
  /** Host-level marketplace opt-in. Both still needs this on. */
  hostMarketplaceOn?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fromProps = visibilityFromFlags(published, listOnMarketplace);
  const [current, setCurrent] = useState<ListingVisibility>(fromProps);

  useEffect(() => {
    setCurrent(fromProps);
  }, [fromProps]);

  function onPick(visibility: ListingVisibility) {
    const previous = current;
    setError(null);
    setCurrent(visibility);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("visibility", visibility);
        await updateListingVisibility(fd);
        router.refresh();
      } catch (e) {
        setCurrent(previous);
        setError(e instanceof Error ? e.message : "Could not update");
      }
    });
  }

  return (
    <fieldset
      className={cn(
        "min-w-0",
        compact
          ? "space-y-1"
          : "rounded-2xl border border-stone-200 bg-white p-4 shadow-sm",
      )}
    >
      <legend
        className={cn(
          "font-semibold text-stone-900",
          compact ? "text-xs uppercase tracking-wide text-stone-500" : "text-sm",
        )}
      >
        Taking bookings
      </legend>
      {!compact ? (
        <p className="mt-1 text-xs text-stone-500">
          This is the on/off switch. Pick one — it saves as soon as you click.
        </p>
      ) : null}
      <div className={cn("grid gap-1.5", compact ? "mt-1" : "mt-3")}>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm",
              current === opt.value
                ? "border-bonnet bg-petal/60"
                : "border-stone-200 bg-white hover:bg-stone-50",
              pending && "opacity-70",
            )}
          >
            <input
              type="radio"
              name={`visibility-${propertyId}`}
              value={opt.value}
              checked={current === opt.value}
              disabled={pending}
              onChange={() => onPick(opt.value)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-stone-900">{opt.label}</span>
              {!compact ? (
                <span className="mt-0.5 block text-xs text-stone-500">
                  {opt.hint}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {current === "both" && !hostMarketplaceOn ? (
        <p className="mt-2 text-xs text-amber-800">
          Brand marketplace is off, so Find a Place still hides this stay. Turn
          the brand on under Brand &amp; website.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-medium text-bonnet">{error}</p>
      ) : null}
    </fieldset>
  );
}
