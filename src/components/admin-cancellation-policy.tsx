"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { savePropertyCancellationPolicy } from "@/app/actions/cancellation-policy";
import { Button, Card, Label } from "@/components/ui";
import {
  HELP_CANCELLATION_POLICIES_PATH,
  LONG_STAY_NIGHTS_MIN,
  LONG_STAY_POLICIES,
  SHORT_STAY_NIGHTS_MAX,
  SHORT_STAY_POLICIES,
  getLongStayPolicy,
  getShortStayPolicy,
  type LongStayPolicyId,
  type ShortStayPolicyId,
} from "@/lib/cancellation-policies";

type Props = {
  propertyId: string;
  shortPolicy: string;
  longPolicy: string;
  nonRefundableOption: boolean;
  saved?: string;
};

export function AdminCancellationPolicy({
  propertyId,
  shortPolicy,
  longPolicy,
  nonRefundableOption,
  saved,
}: Props) {
  const [shortId, setShortId] = useState(shortPolicy);
  const [longId, setLongId] = useState(longPolicy);

  const short = useMemo(() => getShortStayPolicy(shortId), [shortId]);
  const long = useMemo(() => getLongStayPolicy(longId), [longId]);

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">
            Cancellation policy
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Choose how refunds work for this listing. Short stays (
            {SHORT_STAY_NIGHTS_MAX} nights or fewer) and monthly stays (
            {LONG_STAY_NIGHTS_MIN}+ nights) can use different policies.
          </p>
        </div>
        <Link
          href={HELP_CANCELLATION_POLICIES_PATH}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-bonnet shadow-sm hover:bg-stone-50"
        >
          View full policy article →
        </Link>
      </div>

      {saved === "policy" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Cancellation policy saved for this listing.
        </p>
      ) : null}

      <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 text-sm text-bonnet">
        <p className="font-medium">Help article</p>
        <p className="mt-1 text-bonnet/80">
          Same structure as a full host policy guide: short stays, monthly
          stays, non-refundable rates, and when rules may be overridden.
        </p>
        <Link
          href={HELP_CANCELLATION_POLICIES_PATH}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block font-semibold text-bonnet underline-offset-2 hover:underline"
        >
          Open “Cancellation policies for your home”
        </Link>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
        <p className="font-medium text-stone-800">Currently selected</p>
        <p className="mt-1">
          Short stays: <strong>{short.name}</strong> - {short.summary}
        </p>
        <p className="mt-1">
          Monthly stays: <strong>{long.name}</strong> - {long.summary}
        </p>
      </div>

      <form action={savePropertyCancellationPolicy} className="space-y-5">
        <input type="hidden" name="propertyId" value={propertyId} />

        <div>
          <Label htmlFor="cancellationPolicy">
            Short-stay policy (≤ {SHORT_STAY_NIGHTS_MAX} nights)
          </Label>
          <select
            id="cancellationPolicy"
            name="cancellationPolicy"
            value={shortId}
            onChange={(e) => setShortId(e.target.value as ShortStayPolicyId)}
            className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-bonnet focus:ring-2 focus:ring-petal"
          >
            <optgroup label="Standard">
              {SHORT_STAY_POLICIES.filter((p) => !p.restricted).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Stricter">
              {SHORT_STAY_POLICIES.filter((p) => p.restricted).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          </select>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stone-500">
            {short.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>

        <div>
          <Label htmlFor="longTermCancellationPolicy">
            Monthly policy ({LONG_STAY_NIGHTS_MIN}+ nights)
          </Label>
          <select
            id="longTermCancellationPolicy"
            name="longTermCancellationPolicy"
            value={longId}
            onChange={(e) => setLongId(e.target.value as LongStayPolicyId)}
            className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-bonnet focus:ring-2 focus:ring-petal"
          >
            {LONG_STAY_POLICIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stone-500">
            {long.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-white p-4">
          <input
            type="checkbox"
            name="nonRefundableOption"
            defaultChecked={nonRefundableOption}
            className="mt-1 size-4 rounded border-stone-300"
          />
          <span>
            <span className="block text-sm font-semibold text-stone-900">
              Offer a non-refundable discounted rate (short stays)
            </span>
            <span className="mt-0.5 block text-sm text-stone-500">
              Guests may book a lower rate that generally is not refundable after
              the 24-hour free window. Details are in the full policy article.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Save cancellation policy</Button>
          <Link
            href={HELP_CANCELLATION_POLICIES_PATH}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
          >
            Read the full article
          </Link>
        </div>
      </form>
    </Card>
  );
}
