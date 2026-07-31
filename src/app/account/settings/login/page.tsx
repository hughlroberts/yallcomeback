import { redirect } from "next/navigation";
import { changePassword } from "@/app/actions/account";
import {
  AccountSettingsShell,
  SavedBanner,
} from "@/components/account-settings-shell";
import { Button, Input, Label } from "@/components/ui";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Login & security" };

export default async function LoginSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login");

  const isHost = user.role === "HOST" || user.role === "ADMIN";

  const errorMsg =
    params.error === "short"
      ? "New password must be at least 8 characters."
      : params.error === "mismatch"
        ? "New passwords do not match."
        : params.error === "current"
          ? "Current password is incorrect."
          : params.error === "none"
            ? "This account has no password set."
            : null;

  return (
    <AccountSettingsShell
      active="login"
      isHost={isHost}
      title="Login & security"
    >
      <SavedBanner show={params.saved === "1"} />
      {errorMsg ? (
        <p className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </p>
      ) : null}

      <section className="border-b border-stone-100 pb-8">
        <h2 className="text-base font-semibold text-stone-900">Login</h2>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-stone-900">Password</p>
            <p className="mt-0.5 text-sm text-stone-500">
              {user.passwordHash ? "Last updated on file" : "Not set"}
            </p>
          </div>
        </div>

        <form action={changePassword} className="mt-6 max-w-md space-y-3">
          <div>
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit">Update password</Button>
        </form>
      </section>

      <section className="pt-8">
        <h2 className="text-base font-semibold text-stone-900">Account</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <p className="font-medium text-stone-900">Email</p>
              <p className="mt-0.5 text-stone-500">{user.email}</p>
            </div>
            <span className="text-stone-400">Sign-in</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <p className="font-medium text-stone-900">Role</p>
              <p className="mt-0.5 capitalize text-stone-500">
                {user.role.toLowerCase()}
              </p>
            </div>
          </div>
          <div className="flex justify-between gap-4">
            <div>
              <p className="font-medium text-stone-900">Sessions</p>
              <p className="mt-0.5 text-stone-500">
                Sign out from the header when you&apos;re done on a shared
                device.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AccountSettingsShell>
  );
}
