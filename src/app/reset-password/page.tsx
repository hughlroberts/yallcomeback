import { resetPasswordWithForm } from "@/app/actions/auth-email";
import { Button, Input, Label, Card } from "@/components/ui";
import { peekAuthToken } from "@/lib/auth-tokens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const token = String(sp.token || "").trim();
  const peeked = token ? await peekAuthToken(token, "PASSWORD_RESET") : null;
  const invalid = !peeked || sp.error === "invalid";

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Set a new password
        </h1>

        {sp.error === "rate" ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            Too many attempts. Wait a few minutes and try again.
          </p>
        ) : null}

        {invalid ? (
          <>
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
              This reset link is invalid or has expired. Request a new one.
            </p>
            <p className="mt-6 text-center text-sm text-stone-500">
              <a href="/forgot-password" className="font-medium text-bonnet">
                Forgot password
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              Choose a password of at least 8 characters. You will be signed in
              after you save it.
            </p>
            {sp.error === "short" ? (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
                Password must be at least 8 characters.
              </p>
            ) : null}
            {sp.error === "mismatch" ? (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-inset ring-red-100">
                Passwords do not match.
              </p>
            ) : null}
            <form action={resetPasswordWithForm} className="mt-6 space-y-4">
              <input type="hidden" name="token" value={token} />
              <div>
                <Label htmlFor="password">New password</Label>
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
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Save password and sign in
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
