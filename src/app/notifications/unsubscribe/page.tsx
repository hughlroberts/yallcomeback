import Link from "next/link";
import {
  applyChannelOptOut,
  verifyUnsubscribeToken,
} from "@/lib/notification-prefs";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Unsubscribe",
  description: "Manage email notification preferences for Yall Come Back.",
  path: "/notifications/unsubscribe",
  noIndex: true,
});

/**
 * The link only shows a button. Link scanners in some mail systems open every
 * link, so a plain visit must not unsubscribe. One-click from the mail app's
 * own "Unsubscribe" button goes to /api/notifications/unsubscribe (POST).
 */
async function confirmUnsubscribe(formData: FormData) {
  "use server";
  const token = String(formData.get("token") || "").trim();
  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) {
    redirect(`/notifications/unsubscribe?token=${encodeURIComponent(token)}`);
  }
  await applyChannelOptOut({
    channel: verified.channel,
    address: verified.address,
    source: "email_link",
  });
  redirect(
    `/notifications/unsubscribe?token=${encodeURIComponent(token)}&done=1`,
  );
}

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

  if (done !== "1") {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-stone-900">
          Stop {label}?
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          We will stop sending {label} to{" "}
          <strong className="font-medium text-stone-800">
            {verified.address}
          </strong>
          . You can still read your messages in the inbox when you sign in.
        </p>
        <form action={confirmUnsubscribe} className="mt-4">
          <input type="hidden" name="token" value={token.trim()} />
          <SubmitButton pendingLabel="Unsubscribing…">Unsubscribe</SubmitButton>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-stone-900">You&apos;re unsubscribed</h1>
      <p className="mt-2 text-sm text-stone-600">
        We won&apos;t send {label} to{" "}
        <strong className="font-medium text-stone-800">{verified.address}</strong>{" "}
        anymore. You can still use the in-app inbox when signed in.
      </p>
      <p className="mt-4 text-sm text-stone-600">
        Change your mind later in{" "}
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
