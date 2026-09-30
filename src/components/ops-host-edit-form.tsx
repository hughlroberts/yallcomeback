"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

type PlanOption = { id: string; name: string; monthlyPrice: number };

/**
 * Ops host editor. Moving a paying host onto Complimentary requires an
 * explicit “Are you sure?” — Stripe billing is paused only after that.
 */
export function OpsHostEditForm({
  action,
  hostName,
  currentPlanId,
  currentPlanName,
  currentMonthlyPrice,
  hasStripeSubscription,
  plans,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  hostName: string;
  currentPlanId: string | null;
  currentPlanName: string | null;
  currentMonthlyPrice: number;
  hasStripeSubscription: boolean;
  plans: PlanOption[];
  children: ReactNode;
}) {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const allowSubmitRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [pendingPlanName, setPendingPlanName] = useState("Complimentary");

  const currentlyPaid = currentMonthlyPrice > 0;

  function selectedComplimentary(form: HTMLFormElement) {
    const nextId = String(new FormData(form).get("planId") || "");
    const next = plans.find((p) => p.id === nextId);
    if (!next || next.monthlyPrice > 0) return null;
    if (!currentlyPaid) return null;
    if (nextId === (currentPlanId || "")) return null;
    return next;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (allowSubmitRef.current) {
      allowSubmitRef.current = false;
      return;
    }
    const next = selectedComplimentary(e.currentTarget);
    if (!next) return;
    e.preventDefault();
    setPendingPlanName(next.name);
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
  }

  function accept() {
    allowSubmitRef.current = true;
    setOpen(false);
    formRef.current?.requestSubmit();
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={onSubmit}
        className="mt-6 grid gap-4 sm:grid-cols-2"
      >
        {children}
      </form>
      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) cancel();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl sm:p-6"
          >
            <h3
              id={titleId}
              className="text-lg font-semibold tracking-tight text-ink"
            >
              Are you sure?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Move <strong className="text-ink">{hostName}</strong> from{" "}
              {currentPlanName || "a paid plan"} to{" "}
              <strong className="text-ink">{pendingPlanName}</strong> (free,
              never billed)?
              {hasStripeSubscription
                ? " Their Stripe subscription will be paused so they are not charged again."
                : " They will stay on the platform at $0."}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
              <Button type="button" variant="danger" autoFocus onClick={accept}>
                Yes, make complimentary
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
