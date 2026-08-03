import Link from "next/link";
import { redirect } from "next/navigation";
import { updateNotificationSettings } from "@/app/actions/account";
import { AccountSettingsShell } from "@/components/account-settings-shell";
import { Button, Card } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSmsMessagingEnabled } from "@/lib/messaging";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · Account" };

export default async function NotificationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/settings/notifications");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      role: true,
      emailNotifications: true,
      smsNotifications: true,
    },
  });
  if (!user) redirect("/login?callbackUrl=/account/settings/notifications");

  const isHost = user.role === "HOST" || user.role === "ADMIN";
  const smsLive = isSmsMessagingEnabled();
  const sp = await searchParams;

  return (
    <AccountSettingsShell
      active="notifications"
      isHost={isHost}
      title="Notifications"
      description="Choose how you hear about new guest and host messages. You can also unsubscribe from any message email."
    >
      {sp.saved ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Preferences saved.
        </p>
      ) : null}

      <Card className="p-6">
        <form action={updateNotificationSettings} className="space-y-6">
          <input
            type="hidden"
            name="returnTo"
            value="/account/settings/notifications"
          />

          <div>
            <h2 className="text-base font-semibold text-stone-900">Email</h2>
            <p className="mt-1 text-sm text-stone-500">
              Sent to <strong className="font-medium">{user.email}</strong> when
              someone messages you. Every message email includes an unsubscribe
              link.
            </p>
            <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-stone-900">
                  Message emails
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  New conversation replies and booking message alerts
                </span>
              </span>
              <input
                type="checkbox"
                name="emailNotifications"
                defaultChecked={user.emailNotifications}
                className="mt-1 size-4 rounded border-stone-300"
              />
            </label>
          </div>

          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Text messages (SMS)
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Ready for when SMS is turned on for the platform. Requires a phone
              number on your profile
              {user.phone ? (
                <>
                  {" "}
                  (<strong className="font-medium">{user.phone}</strong>)
                </>
              ) : (
                <>
                  {" "}
                  —{" "}
                  <Link
                    href="/account/settings/personal"
                    className="font-medium text-bonnet hover:underline"
                  >
                    add a phone number
                  </Link>
                </>
              )}
              .{" "}
              {smsLive
                ? "SMS delivery is currently enabled on this deployment."
                : "SMS is not live yet; your choice is saved for launch."}
            </p>
            <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-stone-200 px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-stone-900">
                  Message texts
                </span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  Short alerts for new messages (opt-in)
                </span>
              </span>
              <input
                type="checkbox"
                name="smsNotifications"
                defaultChecked={user.smsNotifications}
                className="mt-1 size-4 rounded border-stone-300"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Save preferences</Button>
            <Link
              href="/messages"
              className="text-sm font-medium text-bonnet hover:underline"
            >
              Open messages →
            </Link>
          </div>
        </form>
      </Card>
    </AccountSettingsShell>
  );
}
