"use client";

import { useState } from "react";
import { resendVerificationEmail } from "@/app/actions/auth-email";

export function ResendVerifyButton({
  className = "font-semibold underline",
}: {
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onResend() {
    setPending(true);
    setMsg(null);
    const result = await resendVerificationEmail();
    setPending(false);
    setMsg(result.error || result.message || "Sent.");
  }

  return (
    <span className="inline">
      <button
        type="button"
        onClick={onResend}
        disabled={pending}
        className={className}
      >
        {pending ? "Sending…" : "Resend the link"}
      </button>
      {msg ? <span className="mt-1 block text-sm">{msg}</span> : null}
    </span>
  );
}
