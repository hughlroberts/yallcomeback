"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { startGuestConversation } from "@/app/actions/messages";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Client-only flag without setState-in-effect (portals need the browser). */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type FormProps = {
  /** Listing thread (book / marketplace). Optional if hostId is set. */
  propertyId?: string;
  propertyTitle?: string;
  /** Brand-site contact (About / footer) without a specific listing. */
  hostId?: string;
  hostName?: string;
  bookingId?: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  /** Prefill subject (e.g. booking dates) */
  defaultSubject?: string;
  /** When true and name/email are prefilled, hide contact fields */
  hideContactFields?: boolean;
};

/** Compact message form body (used inside the host-card dialog). */
function MessageHostFields({
  propertyId,
  propertyTitle,
  hostId,
  hostName,
  bookingId,
  defaultName = "",
  defaultEmail = "",
  defaultPhone = "",
  defaultSubject = "",
  hideContactFields = false,
  onCancel,
}: FormProps & { onCancel?: () => void }) {
  const hideContact =
    hideContactFields && Boolean(defaultName.trim() && defaultEmail.trim());
  const aboutLabel =
    propertyTitle?.trim() ||
    hostName?.trim() ||
    "this host";

  return (
    <form action={startGuestConversation} className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-stone-900">Message host</h3>
        <p className="mt-1 text-sm text-stone-500">
          {propertyTitle
            ? `About ${propertyTitle}. Optional — your thread opens in Messages after you send.`
            : `Message ${aboutLabel} through Yall Come Back. Prefer this if you don’t want to call or email. Your thread opens in Messages after you send.`}
        </p>
      </div>
      {propertyId ? (
        <input type="hidden" name="propertyId" value={propertyId} />
      ) : null}
      {hostId && !propertyId ? (
        <input type="hidden" name="hostId" value={hostId} />
      ) : null}
      {bookingId ? (
        <input type="hidden" name="bookingId" value={bookingId} />
      ) : null}
      {hideContact ? (
        <>
          <input type="hidden" name="guestName" value={defaultName} />
          <input type="hidden" name="guestEmail" value={defaultEmail} />
          {defaultPhone ? (
            <input type="hidden" name="guestPhone" value={defaultPhone} />
          ) : null}
        </>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {!hideContact ? (
          <>
            <div>
              <Label htmlFor="guestName">Your name</Label>
              <Input
                id="guestName"
                name="guestName"
                required
                defaultValue={defaultName}
              />
            </div>
            <div>
              <Label htmlFor="guestEmail">Email</Label>
              <Input
                id="guestEmail"
                name="guestEmail"
                type="email"
                required
                defaultValue={defaultEmail}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="guestPhone">Phone (optional)</Label>
              <Input
                id="guestPhone"
                name="guestPhone"
                type="tel"
                defaultValue={defaultPhone}
              />
            </div>
          </>
        ) : null}
        <div className="sm:col-span-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            name="subject"
            placeholder="Dates, boats, arrival…"
            defaultValue={defaultSubject}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="body">Message</Label>
          <Textarea id="body" name="body" rows={4} required />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Not now
          </Button>
        ) : null}
        <Button type="submit">Send message</Button>
      </div>
    </form>
  );
}

/**
 * “Message host” control — listing pages or host-site contact (About / footer).
 * Opens the same messaging tools guests use on listings.
 */
export function MessageHostButton({
  propertyId,
  propertyTitle,
  hostId,
  hostName,
  bookingId,
  defaultName,
  defaultEmail,
  defaultPhone,
  defaultSubject,
  hideContactFields,
  label = "Message host",
  className,
  variant = "primary",
}: FormProps & {
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "link";
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const mounted = useIsClient();
  const aboutLabel = propertyTitle?.trim() || hostName?.trim() || "host";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bonnet",
          variant === "link"
            ? "rounded-none p-0 text-sm font-medium text-[var(--color-brand,#2563eb)] underline-offset-2 hover:underline"
            : variant === "secondary"
              ? "rounded-lg border border-lupine/40 bg-white px-6 py-3 text-sm font-semibold text-bonnet shadow-sm hover:bg-petal"
              : "rounded-lg bg-bonnet px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-bonnet-hover",
          className,
        )}
      >
        {label}
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl sm:p-6"
              >
                <div className="mb-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    aria-label="Close"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div id={titleId} className="sr-only">
                  Message {aboutLabel}
                </div>
                <MessageHostFields
                  propertyId={propertyId}
                  propertyTitle={propertyTitle}
                  hostId={hostId}
                  hostName={hostName}
                  bookingId={bookingId}
                  defaultName={defaultName}
                  defaultEmail={defaultEmail}
                  defaultPhone={defaultPhone}
                  defaultSubject={defaultSubject}
                  hideContactFields={hideContactFields}
                  onCancel={() => setOpen(false)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** @deprecated Prefer MessageHostButton — kept for rare inline embeds */
export function MessageHostForm(props: FormProps) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <MessageHostFields {...props} />
    </div>
  );
}
