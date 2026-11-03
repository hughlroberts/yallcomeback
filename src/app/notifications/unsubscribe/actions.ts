"use server";

import { redirect } from "next/navigation";
import {
  applyChannelOptOut,
  applyChannelResubscribe,
  verifyUnsubscribeToken,
} from "@/lib/notification-prefs";

function back(token: string, extra = ""): never {
  redirect(`/notifications/unsubscribe?token=${encodeURIComponent(token)}${extra}`);
}

/**
 * Stop message emails for the signed token's address. The link page only
 * shows a button, so mail scanners that open links cannot unsubscribe.
 */
export async function confirmUnsubscribe(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) back(token);
  await applyChannelOptOut({
    channel: verified.channel,
    address: verified.address,
    source: "email_link",
  });
  back(token, "&done=unsubscribed");
}

/** Re-enable message emails for the signed token's address only. */
export async function confirmResubscribe(formData: FormData) {
  const token = String(formData.get("token") || "").trim();
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) back(token);
  await applyChannelResubscribe({
    channel: verified.channel,
    address: verified.address,
  });
  back(token, "&done=resubscribed");
}
