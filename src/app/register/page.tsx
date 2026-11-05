import { redirect } from "next/navigation";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";
import { prisma } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { Button, Input, Label, Card } from "@/components/ui";
import { homeAfterLogin } from "@/lib/login-home";
import { hashPassword } from "@/lib/password";
import { incomingIp, rateLimitAllow } from "@/lib/rate-limit";
import { sendSignupVerificationEmail } from "@/lib/account-email";
import { TrackSignupStarted } from "@/components/track-signup-started";

import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Create account",
  description: "Create a Yall Come Back guest account to book stays and message hosts.",
  path: "/register",
  noIndex: true,
});

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(homeAfterLogin(session.user.role));
  const sp = await searchParams;

  async function registerAction(formData: FormData) {
    "use server";
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    const ip = await incomingIp();
    if (!rateLimitAllow(`register:ip:${ip}`, 5, 60 * 60 * 1000)) {
      redirect("/register?error=rate");
    }

    if (formData.get("acceptTerms") !== "on") {
      redirect("/register?error=terms");
    }
    if (!email || password.length < 8) {
      redirect("/register?error=invalid");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) redirect("/register?error=exists");

    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        name: name || null,
        email,
        passwordHash,
        role: "GUEST",
      },
    });

    const { trackAnalyticsEvent } = await import("@/lib/analytics");
    trackAnalyticsEvent({
      name: "guest_signup_completed",
      path: "/register",
      userId: created.id,
    });

    try {
      await sendSignupVerificationEmail({
        userId: created.id,
        email,
        name: name || null,
        kind: "guest",
      });
    } catch (err) {
      console.error("[auth] guest signup email failed", err);
    }

    await signIn("credentials", {
      email,
      password,
      redirectTo: homeAfterLogin("GUEST"),
    });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Card>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-stone-500">
          Book stays and view your reservations.
        </p>
        {sp.error === "terms" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            You must agree to the Terms of Service and Privacy Policy.
          </p>
        ) : null}
        {sp.error === "exists" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            An account with that email already exists.
          </p>
        ) : null}
        {sp.error === "invalid" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Enter a valid email and a password of at least 8 characters.
          </p>
        ) : null}
        {sp.error === "rate" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            Too many accounts created from this network. Try again later.
          </p>
        ) : null}
        <TrackSignupStarted name="guest_signup_started" path="/register" />
        <form action={registerAction} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password (min 8 characters)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              minLength={8}
              required
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              className="mt-1"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className={`font-medium text-bonnet underline ${PRIMARY_CTA_FOCUS_CLASS}`}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" className={`font-medium text-bonnet underline ${PRIMARY_CTA_FOCUS_CLASS}`}>
                Privacy Policy
              </a>
              . Bookings are a contract with the host, not Yall Come Back.
            </span>
          </label>
          <Button type="submit" className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-stone-500">
          Already have an account?{" "}
          <a href="/login" className={`font-medium text-bonnet ${PRIMARY_CTA_FOCUS_CLASS}`}>
            Sign in
          </a>
        </p>
        <p className="mt-3 text-center text-sm text-stone-500">
          Are you a host?{" "}
          <a href="/signup" className={`font-medium text-bonnet ${PRIMARY_CTA_FOCUS_CLASS}`}>
            Apply here
          </a>
        </p>
      </Card>
    </div>
  );
}
