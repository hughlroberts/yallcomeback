"use client";

import { useSyncExternalStore } from "react";
import {
  conversationListDateLabel,
  MESSAGE_TIME_FALLBACK_ZONE,
  messageDayKey,
  messageDayLabel,
  messageTimeLabel,
} from "@/lib/message-time";

const noopSubscribe = () => () => {};

/**
 * Hydration-safe zone: the server render and the first client render use the
 * fallback zone, so the HTML matches. Right after hydration React renders
 * again with the browser's own zone (undefined = local).
 */
function useViewerZone(): string | undefined {
  const isClient = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return isClient ? undefined : MESSAGE_TIME_FALLBACK_ZONE;
}

type Kind = "time" | "list";

export function LocalMessageTime({ iso, kind }: { iso: string; kind: Kind }) {
  const zone = useViewerZone();
  const d = new Date(iso);
  const label =
    kind === "time"
      ? messageTimeLabel(d, zone)
      : conversationListDateLabel(d, new Date(), zone);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  );
}

/** Day divider shown before a message that starts a new local day. */
export function LocalDayDivider({
  iso,
  prevIso,
}: {
  iso: string;
  prevIso: string | null;
}) {
  const zone = useViewerZone();
  const d = new Date(iso);
  if (
    prevIso &&
    messageDayKey(new Date(prevIso), zone) === messageDayKey(d, zone)
  ) {
    return null;
  }
  return (
    <div className="mb-4 flex justify-center pt-3 first:pt-0">
      <span
        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500"
        suppressHydrationWarning
      >
        {messageDayLabel(d, new Date(), zone)}
      </span>
    </div>
  );
}
