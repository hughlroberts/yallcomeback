"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AMENITY_GROUPS,
  type AmenityOption,
} from "@/lib/listing-amenities";
import { updatePropertyAmenities } from "@/app/actions/properties";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

function AmenityTile({
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
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-3 rounded-xl border-2 p-3 text-left transition",
        selected
          ? "border-stone-900 bg-stone-50 shadow-sm"
          : "border-stone-200 bg-white hover:border-stone-400",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold",
          selected
            ? "border-bonnet bg-bonnet text-white"
            : "border-stone-300 text-transparent",
        )}
        aria-hidden
      >
        ✓
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="text-lg leading-none" aria-hidden>
            {option.icon}
          </span>
          <span className="text-sm font-semibold text-stone-900">
            {option.label}
          </span>
        </span>
        {option.description ? (
          <span className="mt-0.5 block text-xs text-stone-500">
            {option.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function AdminAmenitiesEditor({
  propertyId,
  initialIds,
}: {
  propertyId: string;
  initialIds: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("propertyId", propertyId);
    fd.set("amenityIds", [...selected].join(","));
    startTransition(async () => {
      try {
        await updatePropertyAmenities(fd);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save amenities");
      }
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Amenities</h2>
          <p className="mt-1 text-sm text-stone-500">
            Select what guests will find at this place. Shown on the listing and
            booking pages.
          </p>
        </div>
        <p className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
          {selected.size} selected
        </p>
      </div>

      {AMENITY_GROUPS.map((group) => (
        <section key={group.id} className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {group.title}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {group.options.map((option) => (
              <AmenityTile
                key={option.id}
                option={option}
                selected={selected.has(option.id)}
                onToggle={() => toggle(option.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {saved ? (
        <p className="mt-4 text-sm font-medium text-emerald-700">
          Amenities saved.
        </p>
      ) : null}

      <div className="mt-5">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save amenities"}
        </Button>
      </div>
    </div>
  );
}
