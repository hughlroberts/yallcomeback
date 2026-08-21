import Link from "next/link";
import { redirect } from "next/navigation";
import {
  opsResetUserPassword,
  opsUpdateUserRole,
  opsUpsertUser,
} from "@/app/actions/ops-users";
import { Button, Card, Input, Label } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hostAccessLabel } from "@/lib/host-access";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users · Ops" };

export default async function OpsUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; q?: string; role?: string }>;
}) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/users");

  const sp = await searchParams;
  const q = sp.q?.trim().toLowerCase() || "";
  const roleFilter = sp.role?.trim() || "";

  const [users, hosts] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...(roleFilter === "ADMIN" || roleFilter === "HOST" || roleFilter === "GUEST"
          ? { role: roleFilter }
          : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hostId: true,
        hostAccess: true,
        createdAt: true,
        host: { select: { name: true, slug: true } },
      },
    }),
    prisma.host.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const error =
    sp.error === "email"
      ? "Enter a valid email."
      : sp.error === "password"
        ? "Password must be at least 8 characters."
        : sp.error === "host"
          ? "Choose a host brand for HOST users."
          : sp.error === "self"
            ? "You cannot demote yourself."
            : sp.error === "missing"
              ? "User not found."
              : null;

  const savedMsg =
    sp.saved === "reset"
      ? "Password reset."
      : sp.saved === "1"
        ? "Saved."
        : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Users
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-stone-500">
          Platform-wide accounts: create users, reset passwords, assign host
          brands and co-host access. Host owners can also invite co-hosts from
          Admin → Team.
        </p>
      </div>

      {savedMsg ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {savedMsg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Card className="p-6">
        <h2 className="font-semibold text-stone-900">Create or update user</h2>
        <p className="mt-1 text-xs text-stone-500">
          If the email already exists, this updates that account (and can set a
          new password).
        </p>
        <form action={opsUpsertUser} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password (min 8; required for new)</Label>
            <Input id="password" name="password" type="password" minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
              defaultValue="HOST"
            >
              <option value="GUEST">Guest</option>
              <option value="HOST">Host / co-host</option>
              <option value="ADMIN">Platform manager</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hostId">Host brand (if HOST)</Label>
            <select
              id="hostId"
              name="hostId"
              className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="">—</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hostAccess">Host access (if HOST)</Label>
            <select
              id="hostAccess"
              name="hostAccess"
              className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
              defaultValue="FULL"
            >
              <option value="OWNER">Owner (full + team)</option>
              <option value="FULL">Full co-host</option>
              <option value="LIMITED">Limited co-host (day-to-day hosting)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save user</Button>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-wrap gap-2">
          <Input
            name="q"
            placeholder="Search email or name"
            defaultValue={sp.q || ""}
            className="w-56"
          />
          <select
            name="role"
            defaultValue={roleFilter}
            className="h-11 rounded-lg border border-stone-300 bg-white px-3 text-sm"
          >
            <option value="">All roles</option>
            <option value="ADMIN">Admin</option>
            <option value="HOST">Host</option>
            <option value="GUEST">Guest</option>
          </select>
          <Button type="submit" variant="secondary">
            Filter
          </Button>
        </form>
        <Link href="/ops/managers" className="text-sm font-medium text-bonnet hover:underline">
          Platform managers →
        </Link>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role / brand</th>
                <th className="px-4 py-3 font-semibold">Password</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u) => (
                <tr key={u.id} className="align-top">
                  <td className="px-4 py-3">
                    <form action={opsUpdateUserRole} id={`user-${u.id}`} className="space-y-2">
                      <input type="hidden" name="id" value={u.id} />
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                          Name
                          {u.id === session.user.id ? (
                            <span className="ml-1 font-normal normal-case text-stone-400">
                              (you)
                            </span>
                          ) : null}
                        </label>
                        <Input
                          name="name"
                          defaultValue={u.name || ""}
                          placeholder="Display name"
                          className="!h-9 min-w-[12rem] text-xs"
                        />
                      </div>
                      <p className="text-xs text-stone-500">{u.email}</p>
                      {u.host ? (
                        <p className="text-[11px] text-stone-400">
                          {u.host.name} · {hostAccessLabel(u.hostAccess)}
                        </p>
                      ) : null}
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <select
                        name="role"
                        form={`user-${u.id}`}
                        defaultValue={u.role}
                        className="w-full rounded border border-stone-200 px-2 py-1.5 text-xs"
                      >
                        <option value="GUEST">GUEST</option>
                        <option value="HOST">HOST</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <select
                        name="hostId"
                        form={`user-${u.id}`}
                        defaultValue={u.hostId || ""}
                        className="w-full rounded border border-stone-200 px-2 py-1.5 text-xs"
                      >
                        <option value="">No brand</option>
                        {hosts.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="hostAccess"
                        form={`user-${u.id}`}
                        defaultValue={u.hostAccess || "FULL"}
                        className="w-full rounded border border-stone-200 px-2 py-1.5 text-xs"
                      >
                        <option value="OWNER">OWNER</option>
                        <option value="FULL">FULL</option>
                        <option value="LIMITED">LIMITED</option>
                      </select>
                      <Button
                        type="submit"
                        form={`user-${u.id}`}
                        variant="secondary"
                        className="!text-xs"
                      >
                        Save user
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <form action={opsResetUserPassword} className="flex flex-col gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <Input
                        name="password"
                        type="password"
                        placeholder="New password"
                        minLength={8}
                        required
                        className="!h-9 text-xs"
                      />
                      <Button type="submit" variant="secondary" className="!text-xs">
                        Reset password
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">No users match.</p>
        ) : null}
      </Card>
    </div>
  );
}
