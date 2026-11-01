"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { guestCancelBooking } from "@/app/actions/guest-cancel";

/**
 * Guest "Cancel request/booking" on the confirmation page. First tap opens
 * the confirm box (also opened directly by the email's cancel link); the
 * guest must tap "Yes, cancel" to submit.
 */
export function GuestCancelPanel({
  bookingId,
  token,
  noun,
  startOpen = false,
  deadlineText,
  moneyText,
}: {
  bookingId: string;
  token: string;
  /** "request" or "booking" */
  noun: "request" | "booking";
  startOpen?: boolean;
  deadlineText: string;
  moneyText: string;
}) {
  const [open, setOpen] = useState(startOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-guest-cancel-step="1"
        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
      >
        Cancel {noun}
      </button>
    );
  }

  return (
    <form
      action={guestCancelBooking}
      role="alertdialog"
      aria-label={`Cancel this ${noun}?`}
      data-guest-cancel-step="2"
      className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-950"
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="t" value={token} />
      <p className="font-semibold">Cancel this {noun}?</p>
      <p className="text-red-900/90">{deadlineText}</p>
      <p className="text-red-900/90">{moneyText}</p>
      <label className="block text-xs font-medium text-red-900">
        Reason (optional, shared with the host)
        <textarea
          name="reason"
          rows={2}
          maxLength={450}
          className="mt-1 block w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-stone-900"
        />
      </label>
      <Buttons onKeep={() => setOpen(false)} noun={noun} />
    </form>
  );
}

function Buttons({ onKeep, noun }: { onKeep: () => void; noun: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Cancelling…" : `Yes, cancel ${noun}`}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={onKeep}
        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-white"
      >
        Keep my {noun}
      </button>
    </div>
  );
}
