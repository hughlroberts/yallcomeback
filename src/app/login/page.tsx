import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button, Input, Label, Card } from "@/components/ui";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  if (session?.user) {
    const roleHome =
      session.user.role === "ADMIN" || session.user.role === "HOST"
        ? "/admin"
        : "/account/bookings";
    redirect(sp.callbackUrl || roleHome);
  }

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const callbackUrl = String(formData.get("callbackUrl") || "/");
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: callbackUrl,
      });
    } catch (e) {
      // Auth.js throws NEXT_REDIRECT on success
      throw e;
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Guests and hosts use the same login.
        </p>

        {sp.error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            Invalid email or password.
          </p>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <input
            type="hidden"
            name="callbackUrl"
            value={sp.callbackUrl || "/"}
          />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-500">
          No account?{" "}
          <a href="/register" className="font-medium text-bonnet">
            Create one
          </a>
        </p>
      </Card>
    </div>
  );
}
