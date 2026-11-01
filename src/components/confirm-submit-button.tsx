"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Two-tap submit for destructive server-action forms. The first tap only
 * asks; the second (inside the confirm box) submits the parent <form>.
 */
export function ConfirmSubmitButton({
  label,
  question,
  detail,
  confirmLabel,
  pendingLabel = "Working…",
  keepLabel = "Keep it",
  className,
}: {
  label: string;
  question: string;
  detail?: string;
  confirmLabel: string;
  pendingLabel?: string;
  keepLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        type="button"
        variant="danger"
        className={className}
        onClick={() => setAsking(true)}
        data-confirm-step="1"
      >
        {label}
      </Button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label={question}
      data-confirm-step="2"
      className="w-full space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-950"
    >
      <p className="font-medium">{question}</p>
      {detail ? <p className="text-xs text-red-900/80">{detail}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="danger"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setAsking(false)}
        >
          {keepLabel}
        </Button>
      </div>
    </div>
  );
}
