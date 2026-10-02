import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button, Input, Label, Card } from "@/components/ui";
import { homeAfterLogin } from "@/lib/login-home";
import { safeInternalPath } from "@/lib/safe-redirect";
import { incomingIp, rateLimitAllow } from "@/lib/rate-limit";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; registered?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const callbackUrl = safeInternalPath(
    sp.callbackUrl ||
      (sp.registered === "host"
        ? "/account/settings/subscription?welcome=1"
        : undefined),
    "/",
  );
  if (session?.user) {
    redirect(homeAfterLogin(session.user.role, sp.callbackUrl));
  }

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");
    const next = safeInternalPath(formData.get("callbackUrl"), "/");
    const ip = await incomingIp();
    if (
      !rateLimitAllow(`login:ip:${ip}`, 40, 15 * 60 * 1000) ||
      !rateLimitAllow(`login:email:${email || "empty"}`, 15, 15 * 60 * 1000)
    ) {
      redirect(
        `/login?error=rate&callbackUrl=${encodeURIComponent(next)}`,
      );
    }
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });
    const dest = homeAfterLogin(user?.role, next);
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: dest,
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
          Guests and hosts use the same login. By signing in you agree to the{" "}
          <a href="/terms" className="font-medium text-bonnet underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="font-medium text-bonnet underline">
            Privacy Policy
          </a>
          .
        </p>

        {sp.registered === "host" ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            Host account created. Sign in, then add a card under Payments to go
            live.
          </p>
        ) : null}
        {sp.error === "rate" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            Too many sign-in attempts. Wait a few minutes and try again.
          </p>
        ) : sp.error ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            Invalid email or password.
          </p>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4">
          <input
            type="hidden"
            name="callbackUrl"
            value={callbackUrl}
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
