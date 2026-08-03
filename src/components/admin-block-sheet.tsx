"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { addCalendarBlock } from "@/app/actions/properties";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";

type Props = {
  open: boolean;
  propertyId: string;
  baseNightlyRate: number;
  /** YYYY-MM-DD check-in */
  startDate: string;
  /** YYYY-MM-DD checkout (exclusive end) */
  endDate: string;
  onClose: () => void;
  onOpenFullBlocks: () => void;
};

function nightsBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function formatLabel(ymd: string) {
  const d = new Date(ymd + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Bottom sheet to block a selected calendar range without leaving the Calendar tab.
 */
export function AdminBlockSheet({
  open,
  propertyId,
  baseNightlyRate,
  startDate,
  endDate,
  onClose,
  onOpenFullBlocks,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const nights = nightsBetween(startDate, endDate);
  const suggested = Math.round(baseNightlyRate * Math.max(nights, 1) * 100) / 100;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while sheet open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      await addCalendarBlock(formData);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="block-sheet-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden",
          "rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl",
          "pb-[env(safe-area-inset-bottom,0px)]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
            <h2
              id="block-sheet-title"
              className="text-lg font-semibold text-stone-900"
            >
              Block these dates
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {formatLabel(startDate)} → {formatLabel(endDate)}
              {nights > 0
                ? ` · ${nights} night${nights === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          action={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4"
        >
          <input type="hidden" name="propertyId" value={propertyId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="sheet-start">Start (check-in)</Label>
              <Input
                id="sheet-start"
                name="startDate"
                type="date"
                required
                defaultValue={startDate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sheet-end">End (checkout day)</Label>
              <Input
                id="sheet-end"
                name="endDate"
                type="date"
                required
                defaultValue={endDate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sheet-type">Type</Label>
              <Select id="sheet-type" name="blockType" defaultValue="OFFLINE">
                <option value="OWNER">Owner use</option>
                <option value="FRIENDS">Friends & family</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OFFLINE">Offline booking</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sheet-who">Who is staying</Label>
              <Input
                id="sheet-who"
                name="occupantName"
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sheet-email">Guest email</Label>
              <Input
                id="sheet-email"
                name="guestEmail"
                type="email"
                placeholder="guest@example.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sheet-phone">Guest phone</Label>
              <Input
                id="sheet-phone"
                name="guestPhone"
                type="tel"
                placeholder="(555) 555-1234"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="sheet-amount">
                Invoice amount ($) · ~{formatMoney(suggested)} suggested
              </Label>
              <Input
                id="sheet-amount"
                name="invoiceAmount"
                type="number"
                step="0.01"
                min={0}
                placeholder={String(suggested)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="sheet-notes">Notes (admin only)</Label>
              <Textarea
                id="sheet-notes"
                name="notes"
                rows={2}
                placeholder="Arrival time, special requests…"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-stone-700 sm:col-span-2">
              <input type="checkbox" name="sendInvoice" className="mt-1 rounded" />
              <span>
                Send Stripe invoice now (needs email + amount; Stripe must be
                configured)
              </span>
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Block dates"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <button
              type="button"
              onClick={onOpenFullBlocks}
              className="ml-auto text-xs font-medium text-stone-500 hover:text-bonnet hover:underline"
            >
              Full blocks tab →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
