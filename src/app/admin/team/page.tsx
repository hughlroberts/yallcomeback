import Link from "next/link";
import { redirect } from "next/navigation";
import {
  inviteCoHost,
  removeCoHost,
  resetCoHostPassword,
  updateCoHostAccess,
} from "@/app/actions/team";
import { Button, Card, Input, Label } from "@/components/ui";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canManageTeam,
  hostAccessDescription,
  hostAccessLabel,
  resolveHostAccessInfo,
} from "@/lib/host-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team · Admin" };

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/team");

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });

  if (!access.hostId) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold text-stone-900">Team</h1>
        <p className="text-sm text-stone-600">
          Platform admins: select a brand in the amber switcher first, then open
          Team to invite co-hosts for that brand only.
        </p>
      </div>
    );
  }

  if (!canManageTeam(info)) {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold text-stone-900">Team</h1>
        <p className="text-sm text-stone-600">
          Only the brand owner can invite or remove co-hosts. You have{" "}
          <strong>{hostAccessLabel(info.level)}</strong> access.
        </p>
        <Link href="/admin" className="text-sm font-semibold text-bonnet hover:underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    select: { id: true, name: true, slug: true },
  });
  if (!host) redirect("/admin");

  const members = await prisma.user.findMany({
    where: { hostId: host.id, role: "HOST" },
    orderBy: [{ hostAccess: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      hostAccess: true,
      createdAt: true,
    },
  });

  const error =
    sp.error === "email"
      ? "Enter a valid email."
      : sp.error === "password"
        ? "Password must be at least 8 characters."
        : sp.error === "forbidden"
          ? "You cannot manage the team."
          : sp.error === "owner"
            ? "Cannot change or remove the brand owner this way."
            : sp.error === "other_brand"
              ? "That email is already on another brand."
              : sp.error === "admin"
                ? "Platform managers cannot be added as co-hosts."
                : sp.error === "self"
                  ? "You cannot change your own access here."
                  : sp.error === "missing"
                    ? "Member not found."
                    : null;

  const saved =
    sp.saved === "removed"
      ? "Co-host removed."
      : sp.saved === "reset"
        ? "Password reset. Share it with them securely."
        : sp.saved === "1"
          ? "Saved."
          : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Team</h1>
        <p className="mt-1 text-sm text-stone-500">
          Invite people to help run{" "}
          <strong className="font-medium text-stone-800">{host.name}</strong>.
          They sign in at the same login page and only see this brand.
        </p>
      </div>

      {saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {saved}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-bonnet/20 bg-petal/30 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-bonnet">
            Full co-host
          </p>
          <p className="mt-2 text-sm font-semibold text-stone-900">
            Almost like you
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            {hostAccessDescription("FULL")}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-stone-500">
            <li>✓ Listings, calendar, photos, bookings, messages</li>
            <li>✓ Brand &amp; website</li>
            <li>✓ Earnings views</li>
            <li>✗ Invite/remove team (owner only)</li>
          </ul>
        </Card>
        <Card className="border-stone-200 bg-stone-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Limited co-host
          </p>
          <p className="mt-2 text-sm font-semibold text-stone-900">
            Day-to-day hosting help
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            {hostAccessDescription("LIMITED")}
          </p>
          <ul className="mt-3 space-y-1 text-xs text-stone-500">
            <li>✓ Calendar, blocks, rates on listings</li>
            <li>✓ Bookings &amp; guest messages</li>
            <li>✓ Photos, amenities, listing content</li>
            <li>✗ Brand site, team, earnings, delete listings</li>
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-stone-900">Invite co-host</h2>
        <form action={inviteCoHost} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Temporary password (min 8)</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hostAccess">Access level</Label>
              <select
                id="hostAccess"
                name="hostAccess"
                defaultValue="LIMITED"
                className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
              >
                <option value="LIMITED">Limited — hosting help</option>
                <option value="FULL">Full — almost owner</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-stone-500">
            Share the email and temporary password with them. They can change
            the password under Account → Login &amp; security after signing in.
          </p>
          <Button type="submit">Invite co-host</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-stone-900">Members</h2>
        <ul className="mt-4 divide-y divide-stone-100">
          {members.map((m) => {
            const level = m.hostAccess ?? "OWNER";
            const isOwner = level === "OWNER";
            return (
              <li
                key={m.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {m.name || "—"}
                    {m.id === access.session.user.id ? (
                      <span className="ml-1 text-xs font-normal text-stone-400">
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-stone-500">{m.email}</p>
                  <p className="mt-0.5 text-xs font-semibold text-stone-600">
                    {hostAccessLabel(level)}
                  </p>
                </div>
                {!isOwner ? (
                  <div className="flex flex-col gap-2 sm:items-end">
                    <form action={updateCoHostAccess} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <select
                        name="hostAccess"
                        defaultValue={level === "FULL" ? "FULL" : "LIMITED"}
                        className="rounded-lg border border-stone-200 px-2 py-1.5 text-xs"
                      >
                        <option value="LIMITED">Limited</option>
                        <option value="FULL">Full</option>
                      </select>
                      <Button type="submit" variant="secondary" className="!text-xs">
                        Update access
                      </Button>
                    </form>
                    <form action={resetCoHostPassword} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <Input
                        name="password"
                        type="password"
                        placeholder="New temp password"
                        minLength={8}
                        required
                        className="!h-9 w-40 text-xs"
                      />
                      <Button type="submit" variant="secondary" className="!text-xs">
                        Reset password
                      </Button>
                    </form>
                    <form action={removeCoHost}>
                      <input type="hidden" name="id" value={m.id} />
                      <Button type="submit" variant="secondary" className="!text-xs !text-red-700">
                        Remove from brand
                      </Button>
                    </form>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">Owner</p>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
