"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  resendVerificationEmail,
  updateAccountEmailAndResend,
} from "@/app/actions/auth-email";
import { cn } from "@/lib/utils";

type Props = {
  initialEmail: string;
  emailVerified: boolean;
  /** Visual tone: amber inside the publish warning, plain on settings. */
  tone?: "amber" | "plain";
  inputId?: string;
};

/**
 * Inline email change + resend. Uses the same server action everywhere:
 * the new address must be unused, confirmation is reset, and a fresh
 * link is sent.
 */
export function AccountEmailChange({
  initialEmail,
  emailVerified,
  tone = "plain",
  inputId = "account-email",
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [verified, setVerified] = useState(emailVerified);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unchanged =
    email.trim().toLowerCase() === savedEmail.trim().toLowerCase();

  async function onSubmit() {
    setPending(true);
    setMsg(null);
    setError(null);
    try {
      if (unchanged) {
        const r = await resendVerificationEmail();
        if (r.error) setError(r.error);
        else setMsg(r.message || "Sent.");
        return;
      }
      const r = await updateAccountEmailAndResend(email);
      if (r.email) {
        setEmail(r.email);
        if (r.email !== savedEmail) {
          setSavedEmail(r.email);
          setVerified(false);
          router.refresh();
        }
      }
      if (r.error) setError(r.error);
      else setMsg(r.message || "Sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  const label = pending
    ? "Sending…"
    : !unchanged
      ? "Save email & send confirmation"
      : verified
        ? "Email confirmed"
        : "Resend confirmation";

  return (
    <div>
      <label
        htmlFor={inputId}
        className={cn(
          "block text-xs font-semibold uppercase tracking-wide",
          tone === "amber" ? "text-amber-900/80" : "text-stone-600",
        )}
      >
        Email
      </label>
      <input
        id={inputId}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        className={cn(
          "mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-stone-900",
          tone === "amber" ? "border-amber-200" : "border-stone-300",
        )}
      />
      <p className="mt-1 text-xs text-stone-500">
        {verified && unchanged
          ? "Confirmed. Changing it signs you in with the new address and needs a new confirmation."
          : "We send a confirmation link to this address. You sign in with it."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !email.trim() || (unchanged && verified)}
          onClick={onSubmit}
          className="rounded-lg bg-bonnet px-4 py-2 text-sm font-medium text-white hover:bg-bonnet-hover disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {label}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="mt-2 text-sm text-emerald-800" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
