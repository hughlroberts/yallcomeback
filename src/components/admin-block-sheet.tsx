"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  addCalendarBlock,
  setNightlyPriceForRange,
} from "@/app/actions/properties";
import { newClientRequestId } from "@/lib/block-dedupe";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { WEBSITE_PAY_CHOICES } from "@/lib/host-payments";
import { cn, formatMoney } from "@/lib/utils";

type Props = {
  open: boolean;
  propertyId: string;
  baseNightlyRate: number;
  /** YYYY-MM-DD check-in */
  startDate: string;
  /** YYYY-MM-DD checkout (exclusive end) */
  endDate: string;
  /** Current nightly price of the first selected night (for the price form). */
  currentNightlyPrice?: number | null;
  onClose: () => void;
  /** Called after a save succeeds (parent clears the selection and shows the message). */
  onSaved?: (message: string) => void;
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

/** Toast text after a save from the sheet. */
export function blockSavedMessage(
  blockType: string,
  nightsLabel: string,
  dates: string,
  duplicate = false,
): string {
  const what =
    blockType === "OFFLINE"
      ? "Offline booking saved"
      : blockType === "FRIENDS"
        ? "Friends & family stay saved"
        : blockType === "OWNER"
          ? "Owner block saved"
          : blockType === "MAINTENANCE"
            ? "Maintenance block saved"
            : "Dates blocked";
  return `${what}${duplicate ? " (already saved)" : ""}: ${nightsLabel}, ${dates}.`;
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
  currentNightlyPrice,
  onClose,
  onSaved,
  onOpenFullBlocks,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pricePending, startPriceTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  // One idempotency key per opened sheet; the server saves it once.
  const [requestId, setRequestId] = useState(() => newClientRequestId());
  const inFlight = useRef(false);
  // New key and cleared errors each time the sheet opens for a range
  // (state adjusted during render, not in an effect).
  const sheetKey = open ? `${startDate}|${endDate}` : "";
  const [lastSheetKey, setLastSheetKey] = useState(sheetKey);
  if (sheetKey !== lastSheetKey) {
    setLastSheetKey(sheetKey);
    if (open) {
      setRequestId(newClientRequestId());
      setError(null);
      setPriceError(null);
    }
  }
  const nights = nightsBetween(startDate, endDate);
  const suggested =
    Math.round(baseNightlyRate * Math.max(nights, 1) * 100) / 100;

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

  const nightsLabel = `${nights} night${nights === 1 ? "" : "s"}`;
  const busy = pending || pricePending;

  function onSubmit(formData: FormData) {
    // Ignore a second tap while the first save is still running.
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const res = await addCalendarBlock(formData);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.refresh();
        if (onSaved)
          onSaved(
            blockSavedMessage(
              String(formData.get("blockType") || ""),
              nightsLabel,
              `${formatLabel(startDate)} → ${formatLabel(endDate)}`,
              Boolean(res.ok && "duplicate" in res && res.duplicate),
            ),
          );
        else onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  function onSetPrice(formData: FormData) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPriceError(null);
    startPriceTransition(async () => {
      try {
        const res = await setNightlyPriceForRange(formData);
        if (!res.ok) {
          setPriceError(res.error);
          return;
        }
        router.refresh();
        const rate = Number(formData.get("nightlyRate"));
        const msg = `Price set to ${formatMoney(rate)}/night for ${nightsLabel}.`;
        if (onSaved) onSaved(msg);
        else onClose();
      } catch (e) {
        setPriceError(e instanceof Error ? e.message : "Could not set price.");
      } finally {
        inFlight.current = false;
      }
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
              {nights === 1
                ? "Block or price this night"
                : "Block or price these dates"}
            </h2>
            <p className="mt-0.5 text-sm text-stone-500">
              {formatLabel(startDate)} → {formatLabel(endDate)}
              {nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}
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

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
          <form
            action={onSetPrice}
            className="rounded-2xl border border-stone-200 bg-stone-50/60 p-3"
            aria-labelledby="sheet-price-title"
          >
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="startDate" value={startDate} />
            <input type="hidden" name="endDate" value={endDate} />
            <p
              id="sheet-price-title"
              className="text-sm font-semibold text-stone-900"
            >
              Nightly price for{" "}
              {nights === 1 ? "this night" : `these ${nightsLabel}`}
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              {currentNightlyPrice != null
                ? `Now ${formatMoney(currentNightlyPrice)} for the first night. `
                : ""}
              Weekend premium still applies on Fri/Sat.
            </p>
            <div className="mt-2 flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="sheet-price">Price per night ($)</Label>
                <Input
                  id="sheet-price"
                  name="nightlyRate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={1}
                  required
                  placeholder={String(
                    Math.round(currentNightlyPrice ?? baseNightlyRate),
                  )}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={busy}>
                {pricePending ? "Saving…" : "Set price"}
              </Button>
            </div>
            {priceError ? (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {priceError}
              </p>
            ) : null}
          </form>

          <form action={onSubmit} className="mt-4 flex flex-col">
            <input type="hidden" name="propertyId" value={propertyId} />
            <input type="hidden" name="clientRequestId" value={requestId} />
            <p className="mb-2 text-sm font-semibold text-stone-900">
              Block or log a stay
            </p>
            <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
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
                <Select id="sheet-type" name="blockType" defaultValue="OWNER">
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
                <Label htmlFor="sheet-guests">Guests</Label>
                <Input
                  id="sheet-guests"
                  name="guestCount"
                  type="number"
                  min={1}
                  placeholder="2"
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
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium text-stone-800">
                  How is this stay paid?
                </legend>
                <p className="text-xs text-stone-500">
                  Required for an offline booking. Owner or maintenance can be
                  unpaid.
                </p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value=""
                    defaultChecked
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-stone-900">
                      Not a paid stay
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      Owner use, maintenance, or a complimentary stay.
                    </span>
                  </span>
                </label>
                {WEBSITE_PAY_CHOICES.map((choice) => (
                  <label
                    key={choice.value}
                    className="flex items-start gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={choice.value}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium text-stone-900">
                        {choice.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {choice.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="sheet-amount">
                  Amount ($, optional) · ~{formatMoney(suggested)} suggested
                </Label>
                <Input
                  id="sheet-amount"
                  name="invoiceAmount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  placeholder={String(suggested)}
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-stone-700 sm:col-span-2">
                <input
                  type="checkbox"
                  name="markPaid"
                  className="mt-1 rounded"
                />
                <span>
                  <span className="font-medium text-stone-900">Paid</span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    Guest already paid (cash, transfer, card in person). No
                    invoice is sent.
                  </span>
                </span>
              </label>
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
                <input
                  type="checkbox"
                  name="sendInvoice"
                  className="mt-1 rounded"
                />
                <span>
                  Send Stripe invoice now (needs email + amount; Stripe must be
                  configured)
                </span>
              </label>
            </fieldset>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-4">
              <Button type="submit" disabled={busy} aria-busy={pending}>
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
    </div>
  );
}
