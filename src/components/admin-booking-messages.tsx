import type { ReactNode } from "react";
import Link from "next/link";
import {
  copyBookingMessagesToAllListings,
  savePropertyBookingMessages,
} from "@/app/actions/booking-messages";
import { MessageTemplateField } from "@/components/message-template-field";
import { Button, Card } from "@/components/ui";

type Props = {
  propertyId: string;
  initial: {
    autoMsgOnBookingEnabled: boolean;
    autoMsgOnBookingBody: string | null;
    autoMsgWeekBeforeEnabled: boolean;
    autoMsgWeekBeforeBody: string | null;
    autoMsgDayBeforeEnabled: boolean;
    autoMsgDayBeforeBody: string | null;
  };
  hostDefaults?: {
    onBooking: string | null;
    weekBefore: string | null;
    dayBefore: string | null;
    weekHours: number;
    dayHours: number;
  };
  listingCount: number;
  saved?: string;
  error?: string;
  copiedCount?: string;
};

function MessageBlock({
  title,
  description,
  enabledName,
  bodyName,
  enabled,
  body,
  placeholder,
  hostFallback,
}: {
  title: string;
  description: string;
  enabledName: string;
  bodyName: string;
  enabled: boolean;
  body: string | null;
  placeholder: string;
  hostFallback?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-stone-900">{title}</h3>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
          {!body?.trim() && hostFallback?.trim() ? (
            <p className="mt-1 text-xs text-bonnet">
              Using host default until you save a listing override.
            </p>
          ) : null}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-800">
          <input
            type="checkbox"
            name={enabledName}
            defaultChecked={enabled || Boolean(!body?.trim() && hostFallback)}
            className="size-4 rounded border-stone-300"
          />
          Enabled
        </label>
      </div>
      <MessageTemplateField
        id={bodyName}
        name={bodyName}
        defaultValue={body}
        placeholder={hostFallback?.trim() || placeholder}
        label="Message (leave empty to use host default)"
        rows={14}
      />
    </div>
  );
}

export function AdminBookingMessages({
  propertyId,
  initial,
  hostDefaults,
  listingCount,
  saved,
  error,
  copiedCount,
  cancellationSlot,
}: Props & { cancellationSlot?: React.ReactNode }) {
  const weekH = hostDefaults?.weekHours ?? 168;
  const dayH = hostDefaults?.dayHours ?? 24;

  return (
    <div className="space-y-6">
      {cancellationSlot}

      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Booking messages
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Optional overrides for this listing. Prefer{" "}
          <Link
            href="/admin/guest-messages"
            className="font-medium text-bonnet hover:underline"
          >
            Message templates
          </Link>{" "}
          to set defaults for every listing (on booking, 1 week before, 1 day
          before).
        </p>
        <p className="mt-2 text-xs text-stone-400">
          Schedule: week-before ~{Math.round(weekH / 24)} day
          {Math.round(weekH / 24) === 1 ? "" : "s"} · day-before ~
          {Math.round(dayH / 24)} day
          {Math.round(dayH / 24) === 1 ? "" : "s"} before check-in (host
          defaults). Click a chip under a message to insert a placeholder at
          the cursor.
        </p>
      </div>

      {saved === "1" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Messages saved for this listing.
        </p>
      ) : null}
      {saved === "copied" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Copied to {copiedCount || "other"} listing
          {copiedCount === "1" ? "" : "s"}. Each listing can still be edited
          separately.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-lupine/40 bg-petal px-4 py-3 text-sm text-blue-950">
          {error === "on_booking_body"
            ? "Add a booking message before enabling a listing override (or leave empty to use the host default)."
            : error === "week_before_body"
              ? "Add a week-before message before enabling it."
              : error === "day_before_body"
                ? "Add a day-before message before enabling it."
                : "Could not save messages."}
        </p>
      ) : null}

      <form action={savePropertyBookingMessages} className="space-y-4">
        <input type="hidden" name="propertyId" value={propertyId} />

        <MessageBlock
          title="When a guest books — confirmation"
          description="Sent to their inbox as soon as they submit a booking request."
          enabledName="autoMsgOnBookingEnabled"
          bodyName="autoMsgOnBookingBody"
          enabled={initial.autoMsgOnBookingEnabled}
          body={initial.autoMsgOnBookingBody}
          hostFallback={hostDefaults?.onBooking}
          placeholder={`Hi {{guestName}}, thanks for booking {{propertyTitle}}!`}
        />

        <MessageBlock
          title="1 week before — invitation / what to expect"
          description={`About ${Math.round(weekH / 24)} day${Math.round(weekH / 24) === 1 ? "" : "s"} before check-in (confirmed bookings).`}
          enabledName="autoMsgWeekBeforeEnabled"
          bodyName="autoMsgWeekBeforeBody"
          enabled={initial.autoMsgWeekBeforeEnabled}
          body={initial.autoMsgWeekBeforeBody}
          hostFallback={hostDefaults?.weekBefore}
          placeholder={`Hi {{guestName}}, your stay at {{propertyTitle}} is about a week away…`}
        />

        <MessageBlock
          title="1 day before — access instructions"
          description={`About ${Math.round(dayH / 24)} day${Math.round(dayH / 24) === 1 ? "" : "s"} before check-in. Door codes, parking, Wi‑Fi.`}
          enabledName="autoMsgDayBeforeEnabled"
          bodyName="autoMsgDayBeforeBody"
          enabled={initial.autoMsgDayBeforeEnabled}
          body={initial.autoMsgDayBeforeBody}
          hostFallback={hostDefaults?.dayBefore}
          placeholder={`Hi {{guestName}}, looking forward to hosting you tomorrow…`}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit">Save for this listing</Button>
        </div>
      </form>

      {listingCount > 1 ? (
        <Card className="border-dashed border-stone-300 bg-stone-50 p-5">
          <h3 className="font-semibold text-stone-900">
            Copy to all listings
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Apply <strong>this listing&apos;s</strong> three templates to your
            other {listingCount - 1} listing
            {listingCount - 1 === 1 ? "" : "s"}.
          </p>
          <form action={copyBookingMessagesToAllListings} className="mt-4">
            <input type="hidden" name="propertyId" value={propertyId} />
            <Button type="submit" variant="secondary">
              Copy these messages to all my listings
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
