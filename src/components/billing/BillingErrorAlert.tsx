import { billingErrorMessage } from "@/lib/branded-upgrade";

/**
 * T38b: billing errors stay on the page as a plain alert box (a toast can
 * vanish before the host sees it). Server component: no timer, no dismiss.
 */
export function BillingErrorAlert({ code }: { code: string | null | undefined }) {
  const message = billingErrorMessage(code);
  if (!message) return null;
  return (
    <div
      role="alert"
      data-testid="billing-error"
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Billing did not open</p>
      <p className="mt-0.5">{message}</p>
    </div>
  );
}
