"use client";

import { Check, Upload } from "lucide-react";
import { useState } from "react";
import type { SavedListing } from "@/lib/saved-listings";
import { SaveListingButton } from "@/components/save-listing-button";

type Props = {
  title: string;
  /** Absolute or path URL; defaults to current page */
  shareUrl?: string;
  listing: Omit<SavedListing, "savedAt">;
};

/**
 * Small Share + Save controls for the listing title row (Airbnb placement).
 */
export function ListingShareSave({ title, shareUrl, listing }: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function onShare() {
    const url =
      shareUrl ||
      (typeof window !== "undefined" ? window.location.href : "");
    if (!url) return;

    setSharing(true);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text: `Check out ${title} on Yall Come Back`,
          url,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
        return;
      }
      window.prompt("Copy this link:", url);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <button
        type="button"
        onClick={onShare}
        disabled={sharing}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-700 underline-offset-2 transition hover:bg-stone-100 hover:underline disabled:opacity-60"
        aria-label="Share this stay"
      >
        {copied ? (
          <Check className="size-4 text-emerald-600" strokeWidth={2} />
        ) : (
          <Upload className="size-4" strokeWidth={1.75} />
        )}
        <span className="hidden sm:inline">
          {copied ? "Link copied" : "Share"}
        </span>
        <span className="sm:hidden">{copied ? "Copied" : "Share"}</span>
      </button>
      <SaveListingButton listing={listing} variant="text" />
    </div>
  );
}
