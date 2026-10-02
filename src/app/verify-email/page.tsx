import Link from "next/link";
import { confirmEmailWithToken } from "@/lib/confirm-email";
import { auth } from "@/lib/auth";
import { homeAfterLogin } from "@/lib/login-home";
import { Card } from "@/components/ui";
import { ResendVerifyButton } from "@/components/resend-verify-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const token = String(sp.token || "");
  const result = token
    ? await confirmEmailWithToken(token)
    : ("missing" as const);

  const next = session?.user
    ? homeAfterLogin(session.user.role)
    : "/login";

  const ok = result === "ok" || result === "already";
  const title =
    result === "ok"
      ? "Email confirmed"
      : result === "already"
        ? "Already confirmed"
        : "Could not confirm";
  const body =
    result === "ok"
      ? "Thanks — your email is confirmed. You can publish a listing when you are ready."
      : result === "already"
        ? "This email is already confirmed."
        : result === "missing"
          ? "This link is missing a token. Open the latest email we sent, or request a new link."
          : "This link is invalid or has expired. Request a new confirmation email.";

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16 sm:px-6">
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p
          className={
            ok
              ? "mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
              : "mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
          }
        >
          {body}
        </p>
        {!ok && session?.user ? (
          <div className="mt-4">
            <ResendVerifyButton />
          </div>
        ) : null}
        {!ok && !session?.user ? (
          <p className="mt-4 text-sm text-stone-500">
            Sign in, then resend the confirmation from Login &amp; security.
          </p>
        ) : null}
        <p className="mt-6 text-center text-sm">
          <Link href={next} className="font-medium text-bonnet">
            {session?.user ? "Continue" : "Sign in"}
          </Link>
        </p>
      </Card>
    </div>
  );
}
