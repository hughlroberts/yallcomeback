import { redirect } from "next/navigation";
import {
  addPlatformManager,
  removePlatformManager,
} from "@/app/actions/managers";
import { Button, Card, Input, Label } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform managers · Ops" };

export default async function OpsManagersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/managers");

  const sp = await searchParams;
  const managers = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  const error =
    sp.error === "email"
      ? "Enter a valid email."
      : sp.error === "password"
        ? "Password must be at least 8 characters."
        : sp.error === "exists"
          ? "That person is already a platform manager."
          : sp.error === "self"
            ? "You cannot remove yourself."
            : sp.error === "missing"
              ? "Manager not found."
              : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Platform managers
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Platform managers run the whole product (ops, hosting billing, all
          hosts). Hosts who create a site get their own host admin for their
          brand. Guests who book are separate accounts.
        </p>
      </div>

      {sp.saved === "1" ? (
        <p className="rounded-xl border border-sage/40 bg-sage/20 px-4 py-3 text-sm text-sage-ink">
          Saved.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <Card>
        <h2 className="font-semibold text-ink">Current managers</h2>
        <ul className="mt-4 divide-y divide-hairline">
          {managers.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="font-medium text-ink">
                  {m.name || "—"}{" "}
                  {m.id === session.user.id ? (
                    <span className="text-xs font-normal text-ink-muted">
                      (you)
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-ink-muted">{m.email}</p>
              </div>
              {m.id !== session.user.id ? (
                <form action={removePlatformManager}>
                  <input type="hidden" name="id" value={m.id} />
                  <Button type="submit" variant="secondary" className="!text-xs">
                    Remove manager access
                  </Button>
                </form>
              ) : (
                <span className="text-xs text-ink-muted">
                  Change password under Account → Login &amp; security
                </span>
              )}
            </li>
          ))}
          {managers.length === 0 ? (
            <li className="py-4 text-sm text-ink-muted">No managers yet.</li>
          ) : null}
        </ul>
      </Card>

      <Card>
        <h2 className="font-semibold text-ink">Add platform manager</h2>
        <p className="mt-1 text-sm text-ink-muted">
          They can sign in at /login and use Admin + Ops. Share a temporary
          password and have them change it after first login.
        </p>
        <form action={addPlatformManager} className="mt-4 grid max-w-lg gap-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Jordan Lee" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="manager@example.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Temporary password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Button type="submit">Add manager</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
