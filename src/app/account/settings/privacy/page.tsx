import { redirect } from "next/navigation";
import { updatePrivacySettings } from "@/app/actions/account";
import {
  AccountSettingsShell,
  SavedBanner,
} from "@/components/account-settings-shell";
import { Button } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy" };

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const isHost = user.role === "HOST" || user.role === "ADMIN";

  return (
    <AccountSettingsShell active="privacy" isHost={isHost} title="Privacy">
      <SavedBanner show={params.saved === "1"} />

      <form action={updatePrivacySettings} className="space-y-8">
        <section>
          <h2 className="text-base font-semibold text-stone-900">Messages</h2>
          <div className="mt-4 flex items-start justify-between gap-6 border-b border-stone-100 pb-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">
                Show people when I&apos;ve read their messages
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Hosts and guests can see read status in the in-app inbox when
                this is on.
              </p>
            </div>
            <Toggle
              name="showReadReceipts"
              defaultChecked={user.showReadReceipts}
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900">Listings</h2>
          <div className="mt-4 flex items-start justify-between gap-6 border-b border-stone-100 pb-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900">
                Include my listing(s) in search engines
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Turning this on means search engines like Google may display
                your public listing pages. Hosts control marketplace visibility
                separately under Host admin.
              </p>
            </div>
            <Toggle
              name="includeListingsInSearch"
              defaultChecked={user.includeListingsInSearch}
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-stone-900">
            Data privacy
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Yall Come Back stores the profile and booking data you provide so hosts
            can confirm stays. You can update or clear optional fields anytime.
            For deletion of your account, contact the platform operator.
          </p>
        </section>

        <Button type="submit">Save privacy settings</Button>
      </form>
    </AccountSettingsShell>
  );
}

function Toggle({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-stone-300 transition peer-checked:bg-bonnet" />
      <span className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}
