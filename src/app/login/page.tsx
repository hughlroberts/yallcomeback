import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Button, Input, Label, Card } from "@/components/ui";
import { destAfterHostAuth, FIRST_LISTING_PATH } from "@/lib/host-signup";
import { safeInternalPath } from "@/lib/safe-redirect";
import { incomingIp, rateLimitAllow } from "@/lib/rate-limit";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Sign in",
  description:
    "Sign in to Yall Come Back to manage bookings, listings, and messages.",
  path: "/login",
  noIndex: true,
});

type LoginError =
  | "rate"
  | "credentials"
  | "missing_email"
  | "missing_password"
  | "missing";

function loginErrorMessage(code: string | undefined): {
  form?: string;
  email?: string;
  password?: string;
} {
  switch (code) {
    case "rate":
      return {
        form: "Too many sign-in attempts. Wait a few minutes and try again.",
      };
    case "missing_email":
      return { email: "Enter your email." };
    case "missing_password":
      return { password: "Enter your password." };
    case "missing":
      return {
        email: "Enter your email.",
        password: "Enter your password.",
      };
    case "admin_only":
      return {
        form: "That page is for platform admins only. Sign in with a platform admin account.",
      };
    case "credentials":
    case "CredentialsSignin":
    case "Configuration":
      return { form: "Wrong email or password." };
    default:
      return code ? { form: "Wrong email or password." } : {};
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    registered?: string;
    email?: string;
  }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const callbackUrl = safeInternalPath(
    sp.callbackUrl ||
      (sp.registered === "host" ? FIRST_LISTING_PATH : undefined),
    "/",
  );
  if (session?.user) {
    redirect(
      await destAfterHostAuth({
        role: session.user.role,
        hostId: session.user.hostId,
        callback: sp.callbackUrl || callbackUrl,
      }),
    );
  }

  const errors = loginErrorMessage(sp.error);
  const emailPrefill = (sp.email || "").trim().toLowerCase();

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") || "");
    const next = safeInternalPath(formData.get("callbackUrl"), "/");
    const emailQ = email ? `&email=${encodeURIComponent(email)}` : "";

    function fail(code: LoginError): never {
      redirect(
        `/login?error=${code}&callbackUrl=${encodeURIComponent(next)}${emailQ}`,
      );
    }

    if (!email && !password) fail("missing");
    if (!email) fail("missing_email");
    if (!password) fail("missing_password");

    const ip = await incomingIp();
    if (
      !rateLimitAllow(`login:ip:${ip}`, 40, 15 * 60 * 1000) ||
      !rateLimitAllow(`login:email:${email || "empty"}`, 15, 15 * 60 * 1000)
    ) {
      fail("rate");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true, hostId: true },
    });
    const dest = await destAfterHostAuth({
      role: user?.role,
      hostId: user?.hostId,
      callback: next,
    });
    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: dest,
      });
    } catch (e) {
      // Auth.js throws a redirect on success — rethrow so navigation works.
      if (e instanceof AuthError) {
        fail("credentials");
      }
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
            Host account created. Sign in, then add your first listing.
          </p>
        ) : null}

        {errors.form ? (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100"
          >
            {errors.form}
          </p>
        ) : null}

        <form action={loginAction} className="mt-6 space-y-4" noValidate>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={emailPrefill}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={
                errors.email
                  ? "border-red-300 focus-visible:ring-red-400"
                  : undefined
              }
            />
            {errors.email ? (
              <p id="email-error" role="alert" className="mt-1.5 text-sm text-red-600">
                {errors.email}
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={
                errors.password
                  ? "border-red-300 focus-visible:ring-red-400"
                  : undefined
              }
            />
            {errors.password ? (
              <p
                id="password-error"
                role="alert"
                className="mt-1.5 text-sm text-red-600"
              >
                {errors.password}
              </p>
            ) : null}
            <p className="mt-2 text-right text-sm">
              <a href="/forgot-password" className="font-medium text-bonnet">
                Forgot password?
              </a>
            </p>
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
        <p className="mt-3 text-center text-sm text-stone-500">
          Are you a host?{" "}
          <a href="/signup" className="font-medium text-bonnet">
            Apply here
          </a>
        </p>
      </Card>
    </div>
  );
}
