"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import type { ButtonHTMLAttributes } from "react";

/**
 * Submit button for server-action forms — shrinks on press and shows
 * “Saving…” + spinner while the action is pending.
 */
export function SubmitButton({
  className,
  variant = "primary",
  children = "Save",
  pendingLabel = "Saving…",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      aria-busy={pending}
      {...props}
      disabled={pending || props.disabled}
    >
      {pending ? (
        <>
          <span
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
