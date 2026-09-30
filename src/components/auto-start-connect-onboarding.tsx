"use client";

import { useEffect, useRef } from "react";

/** Submits Connect onboarding once after signup when the host chose to collect cards. */
export function AutoStartConnectOnboarding() {
  const formRef = useRef<HTMLFormElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    formRef.current?.requestSubmit();
  }, []);

  return (
    <form
      ref={formRef}
      action="/api/stripe/connect/onboard"
      method="post"
    >
      <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700">
        Opening card onboarding…
      </p>
      <noscript>
        <button
          type="submit"
          className="mt-3 rounded-[var(--radius-control)] bg-bonnet px-4 py-2 text-sm font-medium text-white"
        >
          Continue to card onboarding
        </button>
      </noscript>
    </form>
  );
}
