import type { ReactNode } from "react";
import { PRIMARY_CTA_FOCUS_ON_DARK_CLASS } from "@/lib/booking-cta-focus";

/** Keyboard-scrollable code region; inset ring stays visible inside clipped cards. */
export function CodeBlock({
  children,
  "aria-label": label,
}: {
  children?: ReactNode;
  "aria-label": string;
}) {
  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={label}
      className={`overflow-x-auto p-5 text-sm leading-relaxed ${PRIMARY_CTA_FOCUS_ON_DARK_CLASS} focus-visible:ring-inset`}
    >
      {children}
    </pre>
  );
}
