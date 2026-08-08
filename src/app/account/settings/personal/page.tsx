import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  clearUserAvatar,
  updatePersonalInfo,
  uploadUserAvatar,
} from "@/app/actions/account";
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
  searchParams: Promise<{ saved?: string; edit?: string; error?: string }>;
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
      {params.error === "avatar_file" ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Choose an image file for your profile photo.
        </p>
      ) : null}
      {params.error === "avatar_size" ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Photo must be under 4&nbsp;MB.
        </p>
      ) : null}

      {!editing ? (
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {user.avatarUrl ? (
                <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-stone-200 ring-1 ring-stone-200">
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized
                  />
                </span>
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-bonnet text-lg font-semibold text-white">
                  {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold text-stone-900">
                  {user.name || user.preferredName || "Your profile"}
                </p>
                <p className="mt-0.5 text-sm text-stone-500">{user.email}</p>
              </div>
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
        <div className="max-w-lg space-y-8">
          <div className="rounded-2xl border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-900">
              Profile photo
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Guests see this when they message you and on “Meet your host.” Your
              guest website uses this too unless you set a brand logo under Brand
              &amp; website.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {user.avatarUrl ? (
                <span className="relative size-20 overflow-hidden rounded-full bg-stone-100 ring-1 ring-stone-200">
                  <Image
                    src={user.avatarUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                    unoptimized
                  />
                </span>
              ) : (
                <span className="flex size-20 items-center justify-center rounded-full bg-stone-200 text-xl font-semibold text-stone-600">
                  {(user.name || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <form
                action={uploadUserAvatar}
                className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="avatarFile">Photo</Label>
                  <Input
                    id="avatarFile"
                    name="file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    required
                  />
                </div>
                <Button type="submit" variant="secondary">
                  Upload
                </Button>
              </form>
            </div>
            {user.avatarUrl ? (
              <form action={clearUserAvatar} className="mt-3">
                <button
                  type="submit"
                  className="text-xs font-medium text-stone-500 underline-offset-2 hover:underline"
                >
                  Remove photo
                </button>
              </form>
            ) : null}
          </div>

        <form action={updatePersonalInfo} className="space-y-4">
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
        </div>
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
