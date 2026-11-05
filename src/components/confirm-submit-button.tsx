"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/**
 * Two-tap submit for server-action forms. The first tap only asks; the second
 * (inside the confirm box) submits the parent <form>.
 */
export function ConfirmSubmitButton({
  label,
  question,
  detail,
  confirmLabel,
  pendingLabel = "Working…",
  keepLabel = "Keep it",
  className,
  variant = "danger",
}: {
  label: string;
  question: string;
  detail?: string;
  confirmLabel: string;
  pendingLabel?: string;
  keepLabel?: string;
  className?: string;
  /** danger = remove/cancel; primary/secondary = block dates / set price */
  variant?: "danger" | "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  const [asking, setAsking] = useState(false);
  const btnVariant =
    variant === "primary"
      ? "primary"
      : variant === "secondary"
        ? "secondary"
        : "danger";
  const box =
    variant === "danger"
      ? "border-red-200 bg-red-50 text-red-950"
      : "border-stone-200 bg-stone-50 text-stone-900";
  const detailCls =
    variant === "danger" ? "text-red-900/80" : "text-stone-600";

  if (!asking) {
    return (
      <Button
        type="button"
        variant={btnVariant}
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
      className={`w-full space-y-2 rounded-xl border p-3 text-sm ${box}`}
    >
      <p className="font-medium">{question}</p>
      {detail ? <p className={`text-xs ${detailCls}`}>{detail}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={btnVariant}
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
