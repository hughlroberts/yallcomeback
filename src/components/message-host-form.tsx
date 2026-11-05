"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useModalOpen } from "@/lib/modal-open";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { X } from "lucide-react";
import {
  startGuestConversation,
  type GuestInquiryState,
} from "@/app/actions/messages";
import {
  HONEYPOT_FIELD,
  STAMP_FIELD,
  TURNSTILE_ACTION,
} from "@/lib/inquiries/fields";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { MessageHostContactFields } from "@/components/message-host-contact-fields";
import { cn } from "@/lib/utils";
import {
  fetchInquiryFormConfig,
  prepareInquirySubmit,
  type InquiryFormConfig,
} from "@/lib/inquiries/form-config-client";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";

/** Client-only flag without setState-in-effect (portals need the browser). */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Fill-time stamp + optional Turnstile site key from /api/inquiries/form-config */
export type { InquiryFormConfig };

/** A submit that has to fetch its own stamp waits at most this long. */
const SUBMIT_CONFIG_TIMEOUT_MS = 8_000;

type TurnstileApi = {
  render: (
    el: HTMLElement,
    opts: { sitekey: string; action: string; appearance?: string },
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve) => {
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SRC}"]`,
    );
    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(window.turnstile ?? null));
    script.addEventListener("error", () => resolve(null));
  });
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
  /** Trip the guest picked (shown in their receipt email). */
  tripCheckIn?: string;
  tripCheckOut?: string;
  tripGuests?: number;
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
  tripCheckIn,
  tripCheckOut,
  tripGuests,
  config,
  ensureConfig,
  onCancel,
}: FormProps & {
  config: InquiryFormConfig | null;
  /** Loaded config, the one in flight, or a fresh fetch (null if none). */
  ensureConfig: () => Promise<InquiryFormConfig | null>;
  onCancel?: () => void;
}) {
  const hideContact =
    hideContactFields && Boolean(defaultName.trim() && defaultEmail.trim());
  const aboutLabel = propertyTitle?.trim() || hostName?.trim() || "this host";
  const widgetId = useRef<string | null>(null);
  const subjectId = useId();
  const bodyId = useId();

  const submit = useCallback(
    async (prev: GuestInquiryState | undefined, formData: FormData) => {
      // The stamp request may still be pending or may have failed (e.g. a
      // 502 during a deploy); get one now instead of blocking the button.
      const ready = await prepareInquirySubmit(formData, { ensureConfig });
      if (!ready.ok) return { error: ready.error };
      const result = await startGuestConversation(prev, formData);
      // Turnstile tokens are single-use; get a fresh one for the retry.
      if (result.error && widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
      return result;
    },
    [ensureConfig],
  );
  const [state, formAction, pending] = useActionState<
    GuestInquiryState | undefined,
    FormData
  >(submit, undefined);

  const siteKey = config?.turnstileSiteKey ?? null;
  const turnstileRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !siteKey) return;
      void loadTurnstile().then((api) => {
        if (!api || !el.isConnected || el.childElementCount > 0) return;
        widgetId.current = api.render(el, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          appearance: "interaction-only",
        });
      });
    },
    [siteKey],
  );

  if (state?.ok) {
    return (
      <div className="space-y-3" role="status">
        <h3 className="text-lg font-semibold text-stone-900">Message sent</h3>
        <p className="text-sm text-stone-600">
          {aboutLabel === "this host"
            ? "The host"
            : `The host of ${aboutLabel}`}{" "}
          has your question and will reply by email
          {state.sentTo ? ` to ${state.sentTo}` : ""}. Sign in with that email
          to see the thread under Messages.
        </p>
        {onCancel ? (
          <div className="flex justify-end">
            <Button type="button" onClick={onCancel}>
              Done
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="relative space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-stone-900">Message host</h3>
        <p className="mt-1 text-sm text-stone-500">
          {propertyTitle
            ? `Ask about ${propertyTitle} before you book. The host replies by email and in Messages.`
            : `Message ${aboutLabel} through Yall Come Back. Prefer this if you don’t want to call or email. The host replies by email and in Messages.`}
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
      {tripCheckIn ? (
        <input type="hidden" name="tripCheckIn" value={tripCheckIn} />
      ) : null}
      {tripCheckOut ? (
        <input type="hidden" name="tripCheckOut" value={tripCheckOut} />
      ) : null}
      {tripGuests ? (
        <input type="hidden" name="tripGuests" value={String(tripGuests)} />
      ) : null}
      <input type="hidden" name={STAMP_FIELD} value={config?.stamp ?? ""} />
      {/* Honeypot: hidden from people and screen readers; bots fill it. */}
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <label>
          Company website
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
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
          <MessageHostContactFields
            defaultName={defaultName}
            defaultEmail={defaultEmail}
            defaultPhone={defaultPhone}
          />
        ) : null}
        <div className="sm:col-span-2">
          <Label htmlFor={subjectId}>Subject</Label>
          <Input
            id={subjectId}
            name="subject"
            maxLength={150}
            placeholder="Dates, boats, arrival…"
            defaultValue={defaultSubject}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={bodyId}>Message</Label>
          <Textarea
            id={bodyId}
            name="body"
            rows={4}
            required
            minLength={5}
            maxLength={2000}
          />
        </div>
      </div>
      {siteKey ? <div ref={turnstileRef} className="min-h-0" /> : null}
      {state?.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Not now
          </Button>
        ) : null}
        {/* Never gated on the config request, so it can't stick on "Loading…". */}
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
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
  tripCheckIn,
  tripCheckOut,
  tripGuests,
  label = "Message host",
  className,
  variant = "primary",
}: FormProps & {
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "link";
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<InquiryFormConfig | null>(null);
  const configRef = useRef<InquiryFormConfig | null>(null);
  const inflightRef = useRef<Promise<InquiryFormConfig | null> | null>(null);
  const loadSeq = useRef(0);

  // Fresh stamp each time the form opens (fill-time check). Times out instead
  // of hanging; a late answer from an earlier open is ignored.
  const loadConfig = useCallback((timeoutMs?: number) => {
    const seq = ++loadSeq.current;
    const p = fetchInquiryFormConfig({ timeoutMs }).then((c) => {
      if (seq === loadSeq.current && c) {
        configRef.current = c;
        setConfig(c);
      }
      return seq === loadSeq.current ? c : configRef.current;
    });
    inflightRef.current = p;
    return p;
  }, []);

  const ensureConfig = useCallback(async () => {
    if (configRef.current) return configRef.current;
    const pending = inflightRef.current;
    const c = pending ? await pending : null;
    if (c) return c;
    return loadConfig(SUBMIT_CONFIG_TIMEOUT_MS);
  }, [loadConfig]);
  const mounted = useIsClient();
  const aboutLabel = propertyTitle?.trim() || hostName?.trim() || "host";
  // Hides the mobile "Request to book" bar while this dialog is open.
  useModalOpen(open);
  useFocusTrap(dialogRef, open);

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
        onClick={() => {
          setOpen(true);
          configRef.current = null;
          setConfig(null);
          void loadConfig();
        }}
        className={cn(
          `inline-flex items-center justify-center transition ${PRIMARY_CTA_FOCUS_CLASS}`,
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
              data-testid="message-host-overlay"
              // z-[250]: above the sticky header (z-200) and mobile reserve bar
              // (z-150); below the date picker (z-280) and toasts (z-300).
              className="fixed inset-0 z-[250] flex items-end justify-center bg-stone-950/50 px-3 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                data-testid="message-host-dialog"
                // Scrolls inside the visible viewport (dvh tracks the iOS
                // toolbar and keyboard) so the Send button is always reachable.
                className="max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-stone-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] shadow-xl sm:max-h-[90vh] sm:p-6"
              >
                <div className="mb-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={`inline-flex size-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800 ${PRIMARY_CTA_FOCUS_CLASS}`}
                    aria-label="Close message form"
                    data-autofocus
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
                  tripCheckIn={tripCheckIn}
                  tripCheckOut={tripCheckOut}
                  tripGuests={tripGuests}
                  config={config}
                  ensureConfig={ensureConfig}
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
