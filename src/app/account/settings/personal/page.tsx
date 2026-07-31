import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePersonalInfo } from "@/app/actions/account";
import {
  AccountSettingsShell,
  SavedBanner,
  maskEmail,
  maskPhone,
} from "@/components/account-settings-shell";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function PersonalInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account/settings/personal");
  }

  const params = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login?callbackUrl=/account/settings/personal");

  const isHost = user.role === "HOST" || user.role === "ADMIN";
  const editing = params.edit === "1";

  return (
    <AccountSettingsShell
      active="personal"
      isHost={isHost}
      title="Profile"
      description="Your personal details for bookings and messages. Hosts and guests use the same profile."
    >
      <SavedBanner show={params.saved === "1"} />

      {!editing ? (
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4">
            <div>
              <p className="text-base font-semibold text-stone-900">
                {user.name || user.preferredName || "Your profile"}
              </p>
              <p className="mt-0.5 text-sm text-stone-500">{user.email}</p>
            </div>
            <Link
              href="/account/settings/personal?edit=1"
              className="rounded-[var(--radius-control)] bg-bonnet px-5 py-2 text-sm font-semibold text-white hover:bg-bonnet-hover"
            >
              Edit profile
            </Link>
          </div>

          <Row
            label="Legal name"
            value={user.name || "Not provided"}
            href="/account/settings/personal?edit=1"
            action={user.name ? "Edit" : "Add"}
          />
          <Row
            label="Preferred first name"
            value={user.preferredName || "Not provided"}
            href="/account/settings/personal?edit=1"
            action={user.preferredName ? "Edit" : "Add"}
          />
          <Row
            label="Email address"
            value={maskEmail(user.email)}
            hint="Used for booking confirmations and host messages."
            href="/account/settings/personal?edit=1"
            action="Edit"
          />
          <Row
            label="Phone number"
            value={maskPhone(user.phone)}
            hint="Contact number for confirmed stays and host outreach."
            href="/account/settings/personal?edit=1"
            action={user.phone ? "Edit" : "Add"}
          />
          <Row
            label="Residential address"
            value={user.residentialAddress || "Not provided"}
            href="/account/settings/personal?edit=1"
            action={user.residentialAddress ? "Edit" : "Add"}
          />
          <Row
            label="Mailing address"
            value={user.mailingAddress || "Not provided"}
            href="/account/settings/personal?edit=1"
            action={user.mailingAddress ? "Edit" : "Add"}
          />
          <Row
            label="Emergency contact"
            value={user.emergencyContact || "Not provided"}
            href="/account/settings/personal?edit=1"
            action={user.emergencyContact ? "Edit" : "Add"}
          />
        </div>
      ) : (
        <form action={updatePersonalInfo} className="max-w-lg space-y-4">
          <div>
            <Label htmlFor="name">Legal name</Label>
            <Input id="name" name="name" defaultValue={user.name ?? ""} />
          </div>
          <div>
            <Label htmlFor="preferredName">Preferred first name</Label>
            <Input
              id="preferredName"
              name="preferredName"
              defaultValue={user.preferredName ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="bg-stone-50 text-stone-500"
            />
            <p className="mt-1 text-xs text-stone-400">
              Email changes require support for now (used as your sign-in).
            </p>
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ""}
              placeholder="+1 …"
            />
          </div>
          <div>
            <Label htmlFor="residentialAddress">Residential address</Label>
            <Textarea
              id="residentialAddress"
              name="residentialAddress"
              rows={2}
              defaultValue={user.residentialAddress ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="mailingAddress">Mailing address</Label>
            <Textarea
              id="mailingAddress"
              name="mailingAddress"
              rows={2}
              defaultValue={user.mailingAddress ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="emergencyContact">Emergency contact</Label>
            <Textarea
              id="emergencyContact"
              name="emergencyContact"
              rows={2}
              defaultValue={user.emergencyContact ?? ""}
              placeholder="Name, relationship, phone"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit">Save</Button>
            <Link
              href="/account/settings/personal"
              className="inline-flex items-center rounded-lg border border-lupine/50 px-4 py-2 text-sm font-medium text-bonnet hover:bg-petal"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </AccountSettingsShell>
  );
}

function Row({
  label,
  value,
  hint,
  href,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-stone-100 py-5 first:pt-0 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-900">{label}</p>
        <p className="mt-0.5 text-sm text-stone-600">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs leading-relaxed text-stone-400">{hint}</p>
        ) : null}
      </div>
      <Link
        href={href}
        className="shrink-0 text-sm font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline"
      >
        {action}
      </Link>
    </div>
  );
}
