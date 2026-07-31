import {
  loadStarterGuestMessageTemplates,
  saveHostBookingMessageDefaults,
} from "@/app/actions/booking-messages";
import { MessageTemplateField } from "@/components/message-template-field";
import { Button, Input, Label } from "@/components/ui";

type HostDefaults = {
  id: string;
  name: string;
  defaultAutoMsgOnBookingEnabled: boolean;
  defaultAutoMsgOnBookingBody: string | null;
  defaultAutoMsgWeekBeforeEnabled: boolean;
  defaultAutoMsgWeekBeforeBody: string | null;
  defaultAutoMsgDayBeforeEnabled: boolean;
  defaultAutoMsgDayBeforeBody: string | null;
  autoMsgWeekBeforeHours: number;
  autoMsgDayBeforeHours: number;
};

function MessageBlock({
  title,
  description,
  timingNote,
  enabledName,
  bodyName,
  enabled,
  body,
  placeholder,
}: {
  title: string;
  description: string;
  timingNote: string;
  enabledName: string;
  bodyName: string;
  enabled: boolean;
  body: string | null;
  placeholder: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-900">{title}</h3>
          <p className="mt-1 text-sm text-stone-500">{description}</p>
          <p className="mt-1 text-xs font-medium text-bonnet">{timingNote}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-800">
          <input
            type="checkbox"
            name={enabledName}
            defaultChecked={enabled}
            className="size-4 rounded border-stone-300"
          />
          Enabled
        </label>
      </div>
      <MessageTemplateField
        id={bodyName}
        name={bodyName}
        defaultValue={body}
        placeholder={placeholder}
        rows={14}
      />
    </div>
  );
}

export function AdminHostGuestMessages({
  host,
  listingCount,
  saved,
  error,
  applied,
}: {
  host: HostDefaults;
  listingCount: number;
  saved?: string;
  error?: string;
  applied?: string;
}) {
  const weekH = host.autoMsgWeekBeforeHours || 168;
  const dayH = host.autoMsgDayBeforeHours || 24;
  const weekDays = Math.max(1, Math.round(weekH / 24));
  const dayDays = Math.max(1, Math.round(dayH / 24));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">
          Message templates
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Set default messages for <strong>{host.name}</strong>. These apply to
          all {listingCount} listing{listingCount === 1 ? "" : "s"} unless a
          listing sets its own override under Properties → Messages.
        </p>
        <p className="mt-2 text-xs text-stone-400">
          Click a placeholder chip under a message to insert it where your
          cursor is.
        </p>
      </div>

      {saved === "1" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Defaults saved
          {applied === "1"
            ? " and copied onto every listing as overrides."
            : ". Listings without their own templates will use these."}
        </p>
      ) : null}
      {saved === "starters" ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Starter templates loaded. Edit them, then save.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error === "on_booking_body"
            ? "Add an on-booking message before enabling it."
            : error === "week_before_body"
              ? "Add a 1-week-before message before enabling it."
              : error === "day_before_body"
                ? "Add a 1-day-before message before enabling it."
                : "Could not save."}
        </p>
      ) : null}

      <form action={loadStarterGuestMessageTemplates}>
        <input type="hidden" name="hostId" value={host.id} />
        <Button type="submit" variant="secondary">
          Load starter templates
        </Button>
      </form>

      <form action={saveHostBookingMessageDefaults} className="space-y-6">
        <input type="hidden" name="hostId" value={host.id} />

        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
          <h2 className="font-semibold text-stone-900">Default reminder times</h2>
          <p className="mt-1 text-sm text-stone-500">
            Same schedule for every listing. On-booking always sends when the
            guest books.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="autoMsgWeekBeforeDays">
                Week-before message (days before check-in)
              </Label>
              <Input
                id="autoMsgWeekBeforeDays"
                name="autoMsgWeekBeforeDays"
                type="number"
                min={2}
                max={21}
                step={1}
                defaultValue={weekDays}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-stone-400">
                Default 7 days. Invitation / what to expect.
              </p>
            </div>
            <div>
              <Label htmlFor="autoMsgDayBeforeDays">
                Day-before message (days before check-in)
              </Label>
              <Input
                id="autoMsgDayBeforeDays"
                name="autoMsgDayBeforeDays"
                type="number"
                min={1}
                max={3}
                step={1}
                defaultValue={dayDays}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-stone-400">
                Default 1 day. Access instructions go here.
              </p>
            </div>
          </div>
        </div>

        <MessageBlock
          title="1. On booking — confirmation"
          description="Sent to the guest inbox as soon as they submit a booking request."
          timingNote="Sends immediately on booking"
          enabledName="defaultAutoMsgOnBookingEnabled"
          bodyName="defaultAutoMsgOnBookingBody"
          enabled={host.defaultAutoMsgOnBookingEnabled}
          body={host.defaultAutoMsgOnBookingBody}
          placeholder="Thanks for booking… confirmation details"
        />

        <MessageBlock
          title="2. One week before — invitation / what to expect"
          description="Warm prep note for confirmed stays: what to expect, packing tips, neighborhood."
          timingNote={`Default send: ${weekDays} day${weekDays === 1 ? "" : "s"} before check-in`}
          enabledName="defaultAutoMsgWeekBeforeEnabled"
          bodyName="defaultAutoMsgWeekBeforeBody"
          enabled={host.defaultAutoMsgWeekBeforeEnabled}
          body={host.defaultAutoMsgWeekBeforeBody}
          placeholder="Your stay is a week away… what to expect"
        />

        <MessageBlock
          title="3. One day before — access instructions"
          description="Door codes, parking, Wi‑Fi, and arrival steps for confirmed stays."
          timingNote={`Default send: ${dayDays} day${dayDays === 1 ? "" : "s"} before check-in`}
          enabledName="defaultAutoMsgDayBeforeEnabled"
          bodyName="defaultAutoMsgDayBeforeBody"
          enabled={host.defaultAutoMsgDayBeforeEnabled}
          body={host.defaultAutoMsgDayBeforeBody}
          placeholder="See you tomorrow… access and codes"
        />

        <label className="flex items-start gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          <input
            type="checkbox"
            name="applyToAllListings"
            className="mt-0.5 size-4 rounded border-stone-300"
          />
          <span>
            Also copy these templates onto every listing as overrides (optional).
            Leave unchecked to keep host defaults only — listings without their
            own text still inherit automatically.
          </span>
        </label>

        <Button type="submit">Save defaults</Button>
      </form>
    </div>
  );
}
