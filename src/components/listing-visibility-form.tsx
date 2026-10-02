"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateListingVisibility } from "@/app/actions/properties";
import {
  type ListingVisibility,
  visibilityFromFlags,
} from "@/lib/listing-visibility";
import { Label, Select } from "@/components/ui";
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
  emailVerified = true,
}: {
  propertyId: string;
  published: boolean;
  listOnMarketplace: boolean;
  compact?: boolean;
  /** Host-level marketplace opt-in. Both still needs this on. */
  hostMarketplaceOn?: boolean;
  /** False until the host confirms email — On options stay locked. */
  emailVerified?: boolean;
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
    if (!emailVerified && visibility !== "off") {
      setError(
        "Confirm your email before you turn bookings on. Check your inbox, or resend the link from Login & security.",
      );
      return;
    }
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

  const selected = OPTIONS.find((opt) => opt.value === current);

  return (
    <div className={cn("min-w-0", compact ? "w-full max-w-xs" : "w-full sm:max-w-sm")}>
      <Label
        htmlFor={`visibility-${propertyId}`}
        className={cn(compact && "text-xs uppercase tracking-wide text-stone-500")}
      >
        Taking bookings
      </Label>
      <Select
        id={`visibility-${propertyId}`}
        value={current}
        disabled={pending}
        aria-busy={pending}
        className={cn(compact ? "h-9 min-h-0" : "mt-0")}
        onChange={(e) => onPick(e.target.value as ListingVisibility)}
      >
        {OPTIONS.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            disabled={!emailVerified && opt.value !== "off"}
            title={opt.hint}
          >
            {opt.label}
          </option>
        ))}
      </Select>
      {!compact && selected ? (
        <p className="mt-1 text-xs text-stone-500">{selected.hint}</p>
      ) : null}
      {current === "both" && !hostMarketplaceOn ? (
        <p className="mt-2 text-xs text-amber-800">
          Brand marketplace is off, so Find a Place still hides this stay. Turn
          the brand on under Brand &amp; website.
        </p>
      ) : null}
      {!emailVerified ? (
        <p className="mt-2 text-xs text-amber-800">
          Confirm your email before you turn bookings on. Check your inbox, or
          resend from{" "}
          <a href="/account/settings/login" className="font-semibold underline">
            Login &amp; security
          </a>
          .
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-medium text-bonnet">{error}</p>
      ) : null}
    </div>
  );
}
