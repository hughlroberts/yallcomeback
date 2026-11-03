import { Button } from "@/components/ui";

export const TEST_BRAND_INVOICE_OFF_NOTICE =
  "Test brand: invoices and charges are off while live Stripe keys are in use.";

/**
 * T48: "Issue renewal invoice" / "Issue invoice" in Platform admin > hosting.
 * For an internal / QA brand while live Stripe keys are in use the button is
 * disabled and there is no form to submit (the server refuses it too).
 */
export function HostingInvoiceButton({
  action,
  hostId,
  planId,
  notes,
  label,
  blocked,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hostId: string;
  planId: string | null;
  notes?: string;
  label: string;
  blocked: boolean;
}) {
  if (blocked) {
    return (
      <div className="flex flex-col items-end gap-1" data-testid="test-brand-invoice-off">
        <Button type="button" variant="secondary" disabled aria-disabled="true">
          {label}
        </Button>
        <p className="max-w-xs text-right text-xs text-amber-800">
          {TEST_BRAND_INVOICE_OFF_NOTICE}
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="hostId" value={hostId} />
      <input type="hidden" name="planId" value={planId || ""} />
      {notes ? <input type="hidden" name="notes" value={notes} /> : null}
      <Button type="submit" variant="secondary">
        {label}
      </Button>
    </form>
  );
}

/** T48: Mark / unmark a brand as internal / QA. */
export function TestBrandToggle({
  action,
  hostId,
  isTestBrand,
  liveKeys,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hostId: string;
  isTestBrand: boolean;
  liveKeys: boolean;
}) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-3" data-testid="test-brand-toggle">
      <input type="hidden" name="hostId" value={hostId} />
      <input type="hidden" name="isTestBrand" value={isTestBrand ? "0" : "1"} />
      <p className="text-sm text-ink-muted">
        {isTestBrand
          ? liveKeys
            ? "Test brand. Live Stripe keys are in use, so invoices and charges are off."
            : "Test brand. Stripe test keys are in use, so invoices still work."
          : "Not a test brand."}
      </p>
      <Button type="submit" variant="secondary">
        {isTestBrand ? "Unmark test brand" : "Mark as test brand"}
      </Button>
    </form>
  );
}
