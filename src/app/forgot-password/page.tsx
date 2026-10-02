import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/app/actions/auth-email";
import { Button, Input, Label, Card } from "@/components/ui";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;

  if (session?.user && sp.sent !== "1") {
    redirect("/account/settings/login");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Forgot password
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the email on your account. If it matches, we send a reset link.
        </p>

        {sp.error === "rate" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            Too many reset attempts. Wait a few minutes and try again.
          </p>
        ) : null}

        {sp.sent === "1" ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
            If that email is on an account, we sent a reset link. Check your
            inbox (and spam). The link expires in one hour.
          </p>
        ) : (
          <form action={requestPasswordReset} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-stone-500">
          <a href="/login" className="font-medium text-bonnet">
            Back to sign in
          </a>
        </p>
      </Card>
    </div>
  );
}
