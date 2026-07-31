"use client";

import { useRef } from "react";
import { Label, Textarea } from "@/components/ui";

export const MESSAGE_PLACEHOLDERS: {
  token: string;
  label: string;
  hint: string;
}[] = [
  { token: "{{guestName}}", label: "Guest name", hint: "Guest’s name" },
  {
    token: "{{propertyTitle}}",
    label: "Property",
    hint: "Listing title",
  },
  { token: "{{hostName}}", label: "Host name", hint: "Your brand / host name" },
  { token: "{{checkIn}}", label: "Check-in", hint: "Check-in date" },
  { token: "{{checkOut}}", label: "Checkout", hint: "Checkout date" },
  {
    token: "{{checkInTime}}",
    label: "Check-in time",
    hint: "Listed check-in time",
  },
  { token: "{{guests}}", label: "Guests", hint: "Guest count on the booking" },
];

type Props = {
  id: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  label?: string;
  /** Textarea rows (default 14) */
  rows?: number;
};

/**
 * Wide message editor with insertable {{placeholder}} chips under the box.
 */
export function MessageTemplateField({
  id,
  name,
  defaultValue = "",
  placeholder,
  label = "Message",
  rows = 14,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertToken(token: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + token + el.value.slice(end);
    el.value = next;
    const caret = start + token.length;
    el.focus();
    el.setSelectionRange(caret, caret);
    // Notify any listeners / form dirty state
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div className="mt-4">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        ref={ref}
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-1.5 min-h-[280px] w-full resize-y text-[15px] leading-relaxed"
      />
      <div className="mt-3">
        <p className="text-xs font-medium text-stone-500">
          Insert placeholder at cursor
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MESSAGE_PLACEHOLDERS.map((p) => (
            <button
              key={p.token}
              type="button"
              title={`${p.hint} — inserts ${p.token}`}
              onClick={() => insertToken(p.token)}
              className="inline-flex items-center rounded-full border border-lupine/40 bg-petal px-3 py-1.5 text-xs font-medium text-bonnet transition hover:border-lupine/50 hover:bg-petal-hover"
            >
              {p.label}
              <span className="ml-1.5 font-mono text-[10px] text-bonnet/80">
                {p.token}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
