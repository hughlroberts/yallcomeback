import Link from "next/link";
import {
  isChannelOptedOut,
  verifyUnsubscribeToken,
} from "@/lib/notification-prefs";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { confirmResubscribe, confirmUnsubscribe } from "./actions";

import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Unsubscribe",
  description: "Manage email notification preferences for Yall Come Back.",
  path: "/notifications/unsubscribe",
  noIndex: true,
});

/**
 * Shows the address's current state with one button: Unsubscribe when
 * message emails are on, Resubscribe when they are off. A plain visit changes
 * nothing (mail scanners open every link). The mail app's own one-click
 * button POSTs to /api/notifications/unsubscribe.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token, done } = await searchParams;
  if (!token?.trim()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-stone-900">Invalid link</h1>
        <p className="mt-2 text-sm text-stone-600">
          This unsubscribe link is missing or incomplete.
        </p>
      </Shell>
    );
  }

  const verified = verifyUnsubscribeToken(token.trim());
  if (!verified.ok) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-stone-900">Link not valid</h1>
        <p className="mt-2 text-sm text-stone-600">{verified.error}</p>
      </Shell>
    );
  }

  const label =
    verified.channel === "email" ? "message emails" : "message texts (SMS)";
  const optedOut = await isChannelOptedOut({
    channel: verified.channel,
    address: verified.address,
  });
  const address = (
    <strong className="font-medium text-stone-800">{verified.address}</strong>
  );
  const notice =
    done === "unsubscribed" || done === "1"
      ? `Done. We stopped ${label} to this address.`
      : done === "resubscribed"
        ? `Done. ${label[0]!.toUpperCase()}${label.slice(1)} to this address are on again.`
        : null;

  return (
    <Shell>
      {notice ? (
        <p
          role="status"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          {notice}
        </p>
      ) : null}
      {optedOut ? (
        <>
          <h1 className="text-xl font-semibold text-stone-900">
            Already unsubscribed
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Status: <strong className="font-medium">unsubscribed</strong>. We
            do not send {label} to {address}. You can still read your messages
            in the inbox when you sign in.
          </p>
          <form action={confirmResubscribe} className="mt-4">
            <input type="hidden" name="token" value={token.trim()} />
            <SubmitButton pendingLabel="Resubscribing…">Resubscribe</SubmitButton>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-stone-900">
            Stop {label}?
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Status: <strong className="font-medium">subscribed</strong>. We
            send {label} to {address}. If you unsubscribe, you can still read
            your messages in the inbox when you sign in.
          </p>
          <form action={confirmUnsubscribe} className="mt-4">
            <input type="hidden" name="token" value={token.trim()} />
            <SubmitButton pendingLabel="Unsubscribing…">Unsubscribe</SubmitButton>
          </form>
        </>
      )}
      <p className="mt-4 text-sm text-stone-600">
        Signed in? You can also change this in{" "}
        <Link
          href="/account/settings/notifications"
          className="font-semibold text-bonnet hover:underline"
        >
          Account → Notifications
        </Link>
        .
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <Card className="space-y-2 p-6 sm:p-8">{children}</Card>
      <p className="mt-6 text-center text-xs text-stone-400">
        <Link href="/" className="hover:underline">
          ← Yall Come Back
        </Link>
      </p>
    </div>
  );
}
