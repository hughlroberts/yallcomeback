"use client";

import { useState, useTransition } from "react";
import {
  importListingFromUrl,
  previewListingImport,
  type ListingImportPreview,
} from "@/app/actions/listing-import";
import { Button, Input, Label } from "@/components/ui";

type Props = {
  hostId?: string;
  hosts?: { id: string; name: string }[];
  defaultUrl?: string;
};

export function ListingImportAgent({
  hostId,
  hosts = [],
  defaultUrl = "",
}: Props) {
  const [url, setUrl] = useState(defaultUrl);
  const [chosenHostId, setChosenHostId] = useState(
    hostId || hosts[0]?.id || "",
  );
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ListingImportPreview | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runPreview() {
    setError(null);
    setPreview(null);
    setStep("Reading listing page…");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("url", url);
      const res = await previewListingImport(fd);
      if (!res.previewOk) {
        setError(res.error);
        setStep(null);
        return;
      }
      setPreview(res);
      setStep(null);
    });
  }

  function runImport() {
    setError(null);
    setStep("Creating draft and downloading photos…");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("url", url);
        if (chosenHostId) fd.set("hostId", chosenHostId);
        if (rate) fd.set("baseNightlyRate", rate);
        await importListingFromUrl(fd);
      } catch (e) {
        // redirect throws; only real errors land here
        setError(e instanceof Error ? e.message : "Import failed");
        setStep(null);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-hairline bg-porcelain p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bonnet">
            Import agent
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            Copy from Airbnb or VRBO
          </h2>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Paste a public listing URL. We read the page, pull photos and
            details, and open a draft so you can edit before publishing. Best
            effort — OTAs change their sites, so always review the draft.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {hosts.length > 1 ? (
          <div>
            <Label htmlFor="import-host">Host brand</Label>
            <select
              id="import-host"
              className="h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-white px-3 text-sm"
              value={chosenHostId}
              onChange={(e) => setChosenHostId(e.target.value)}
            >
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="import-url">Listing URL</Label>
          <Input
            id="import-url"
            type="url"
            placeholder="https://www.airbnb.com/rooms/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="max-w-xs">
          <Label htmlFor="import-rate">
            Nightly rate (optional — OTAs often hide price)
          </Label>
          <Input
            id="import-rate"
            type="number"
            min={0}
            step="1"
            placeholder="e.g. 285"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {step ? (
          <p className="text-sm font-medium text-bonnet">{step}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !url.trim()}
            onClick={runPreview}
          >
            {pending && !preview ? "Reading…" : "Preview import"}
          </Button>
          <Button
            type="button"
            disabled={pending || !url.trim()}
            onClick={runImport}
          >
            {pending && preview ? "Importing…" : "Import as draft"}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="mt-8 border-t border-hairline pt-6">
          <h3 className="font-semibold text-ink">Preview</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Source: {preview.source}
            {preview.sourceId ? ` · ${preview.sourceId}` : ""} ·{" "}
            {preview.imageUrls.length} photos found
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_160px]">
            <div className="space-y-2 text-sm">
              <p className="text-lg font-semibold text-ink">{preview.title}</p>
              {preview.tagline ? (
                <p className="text-ink-muted">{preview.tagline}</p>
              ) : null}
              <p className="text-ink-muted">
                {[preview.city, preview.region, preview.country]
                  .filter(Boolean)
                  .join(", ") || "Location unknown"}
              </p>
              <p>
                {preview.bedrooms} bed · {preview.beds} beds ·{" "}
                {preview.bathrooms} bath · {preview.maxGuests} guests
              </p>
              <p className="line-clamp-6 whitespace-pre-line text-ink-muted">
                {preview.description}
              </p>
              {preview.amenities.length > 0 ? (
                <p className="text-xs text-ink-muted">
                  Amenities: {preview.amenities.slice(0, 12).join(" · ")}
                  {preview.amenities.length > 12 ? "…" : ""}
                </p>
              ) : null}
            </div>
            {preview.imageUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.imageUrls[0]}
                alt=""
                className="h-36 w-full rounded-xl object-cover sm:h-40"
              />
            ) : null}
          </div>
          {preview.imageUrls.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {preview.imageUrls.slice(0, 8).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-16 w-20 shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
