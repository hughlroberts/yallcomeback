import Link from "next/link";
import { ResendVerifyButton } from "@/components/resend-verify-button";

export function VerifyEmailBanner() {
  return (
    <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      Confirm your email before you publish a listing. Check your inbox, or{" "}
      <ResendVerifyButton />. You can also open{" "}
      <Link
        href="/account/settings/login"
        className="font-semibold underline"
      >
        Login &amp; security
      </Link>
      .
    </p>
  );
}
