import Link from "next/link";
import {
  applyChannelOptOut,
  verifyUnsubscribeToken,
} from "@/lib/notification-prefs";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
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

  await applyChannelOptOut({
    channel: verified.channel,
    address: verified.address,
    source: "email_link",
  });

  const label =
    verified.channel === "email" ? "message emails" : "message texts (SMS)";

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
