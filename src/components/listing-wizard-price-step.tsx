"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { PaymentMethod } from "@prisma/client";
import { saveListingPrices } from "@/app/actions/properties";
import { ListingPaymentMethodFields } from "@/components/listing-payment-method-fields";
import { useListingWizardAutosave } from "@/lib/use-listing-wizard-autosave";
import { WizardMissingFields } from "@/components/wizard-missing-fields";

type Props = {
  propertyId: string;
  canEditDepositMethod?: boolean;
  serverUpdatedAt?: string | Date | null;
  initial: {
    baseNightlyRate: number;
    weekendPremiumPercent: number;
    websitePaymentMethod?: PaymentMethod | string;
  };
};

type PriceFields = {
  base: string;
  weekend: string;
  payMethod: PaymentMethod;
};

export function ListingWizardPriceStep({
  propertyId,
  canEditDepositMethod = true,
  serverUpdatedAt,
  initial,
}: Props) {
  const draftKey = `property-${propertyId}`;
  const { values, setValues } = useListingWizardAutosave<PriceFields>({
    draftKey,
    step: "price",
    serverUpdatedAt,
    initial: {
      base: String(initial.baseNightlyRate > 0 ? initial.baseNightlyRate : 150),
      weekend: String(initial.weekendPremiumPercent || 0),
      payMethod: (initial.websitePaymentMethod as PaymentMethod) || "STRIPE",
    },
  });

  const { base, weekend, payMethod } = values;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const weekendRate = useMemo(() => {
    const b = Number(base);
    const w = Number(weekend);
    if (!Number.isFinite(b) || !Number.isFinite(w)) return null;
    return Math.round(b * (1 + w / 100) * 100) / 100;
  }, [base, weekend]);

  const missing = useMemo(() => {
    const m: string[] = [];
    const baseNum = Number(base);
    const weekendNum = Number(weekend);
    if (!Number.isFinite(baseNum) || baseNum < 1) {
      m.push("Base price (at least $1)");
    }
    if (!Number.isFinite(weekendNum) || weekendNum < 0 || weekendNum > 100) {
      m.push("Weekend adjustment (0–100%)");
    }
    return m;
  }, [base, weekend]);

  function onNext() {
    setError(null);
    const baseNum = Number(base);
    const weekendNum = Number(weekend);
    if (!Number.isFinite(baseNum) || baseNum < 1) {
      setError("Enter a base price of at least $1");
      return;
    }
    if (!Number.isFinite(weekendNum) || weekendNum < 0 || weekendNum > 100) {
      setError("Weekend adjustment should be 0–100%");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("id", propertyId);
        fd.set("baseNightlyRate", String(baseNum));
        fd.set("weekendPremiumPercent", String(weekendNum));
        if (canEditDepositMethod) {
          fd.set("websitePaymentMethod", payMethod);
        }
        await saveListingPrices(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const nextDisabled = pending || missing.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-white">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-4 sm:px-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-bonnet text-sm font-bold text-white">
          S
        </span>
        <Link
          href="/admin/properties"
          className="rounded-full border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
        >
          Save & exit
        </Link>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">
          Now, set your prices
        </h1>
        <p className="mt-2 text-center text-sm text-stone-500">
          You can change these anytime. Weekend price applies Fri & Sat nights.
        </p>

        <div className="mt-10 space-y-3">
          <label className="block rounded-2xl border border-stone-200 bg-white px-5 py-4">
            <span className="text-sm font-medium text-stone-600">Base price</span>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-stone-900">$</span>
              <input
                type="number"
                min={1}
                step="1"
                value={base}
                onChange={(e) =>
                  setValues((p) => ({ ...p, base: e.target.value }))
                }
                className="w-full border-0 bg-transparent text-3xl font-semibold text-stone-900 outline-none"
              />
            </div>
            <span className="mt-1 block text-xs text-stone-400">per night</span>
          </label>

          <label className="block rounded-2xl border border-stone-200 bg-white px-5 py-4">
            <span className="text-sm font-medium text-stone-600">
              Weekend adjustment
            </span>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-semibold text-stone-900">+</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={weekend}
                  onChange={(e) =>
                    setValues((p) => ({ ...p, weekend: e.target.value }))
                  }
                  className="w-20 border-0 bg-transparent text-3xl font-semibold text-stone-900 outline-none"
                />
                <span className="text-2xl font-semibold text-stone-900">%</span>
              </div>
              {weekendRate != null && Number(weekend) > 0 ? (
                <span className="text-sm text-stone-500">
                  ${weekendRate} Fri & Sat
                </span>
              ) : (
                <span className="text-sm text-stone-400">Same as base</span>
              )}
            </div>
          </label>

          {canEditDepositMethod ? (
            <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4">
              <ListingPaymentMethodFields
                value={payMethod}
                onChange={(m) => setValues((p) => ({ ...p, payMethod: m }))}
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </main>

      <footer className="sticky bottom-0 border-t border-stone-200 bg-white">
        <div className="h-1 bg-stone-100">
          <div className="h-full w-[90%] bg-bonnet" />
        </div>
        <div className="mx-auto flex max-w-md flex-col gap-3 px-4 py-4 sm:px-6">
          {nextDisabled && missing.length > 0 ? (
            <WizardMissingFields missing={missing} />
          ) : null}
          <div className="flex items-center justify-between">
            <Link
              href={`/admin/properties/${propertyId}/setup?step=7`}
              className="text-sm font-semibold text-stone-800 underline-offset-2 hover:underline"
            >
              Back
            </Link>
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="rounded-[var(--radius-control)] bg-bonnet px-6 py-3 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-lupine/40"
            >
              {pending ? "Saving…" : "Next"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
