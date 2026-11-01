"use client";

import { useState, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

/**
 * Two-step submit for "Send invoice": the first tap only asks, the second
 * actually emails the guest. Lives inside a server-action <form>.
 */
export function ConfirmSendInvoiceButton() {
  const { pending } = useFormStatus();
  const [ask, setAsk] = useState<string | null>(null);

  function onFirstTap(e: MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.form;
    if (!form) return;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const email = String(data.get("guestEmail") || "").trim();
    const amount = Number(data.get("invoiceAmount") || 0);
    setAsk(
      `Email a ${formatMoney(amount)} Stripe invoice to ${email || "the guest"}?`,
    );
  }

  if (!ask) {
    return (
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onFirstTap}
      >
        Send invoice…
      </Button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      className="w-full space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
    >
      <p className="font-medium">{ask}</p>
      <p className="text-xs text-amber-900/80">
        The guest gets an email right away. This can&apos;t be unsent.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Sending…" : "Yes, email invoice"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setAsk(null)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
