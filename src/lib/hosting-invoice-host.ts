import { prisma } from "@/lib/db";

type Meta = Record<string, string | undefined> | null | undefined;
type Ref = string | { id?: string } | null | undefined;

export type FailedInvoiceLike = {
  metadata?: Meta;
  subscription?: Ref;
  subscription_details?: { metadata?: Meta } | null;
  parent?: {
    subscription_details?: { metadata?: Meta; subscription?: Ref } | null;
  } | null;
};

function refId(v: Ref): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id || null;
}

/** Host id from the hosting metadata on the invoice or its subscription. */
export function hostingHostIdFromInvoiceMetadata(inv: FailedInvoiceLike): string | null {
  const own = inv.metadata;
  if ((own?.kind === "hosting" || own?.kind === "hosting_subscription") && own.hostId) {
    return own.hostId;
  }
  const sub =
    inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
  if (sub?.kind === "hosting_subscription" && sub.hostId) return sub.hostId;
  return null;
}

export function invoiceSubscriptionId(inv: FailedInvoiceLike): string | null {
  return refId(inv.parent?.subscription_details?.subscription) ?? refId(inv.subscription);
}

/**
 * invoice.payment_failed → the hosting host to mark past due (Branded and
 * Marketplace alike). Falls back to the host whose current hosting
 * subscription the invoice is for. Never matches add-on invoices.
 */
export async function failedInvoiceHostingHostId(
  inv: FailedInvoiceLike,
): Promise<string | null> {
  const fromMeta = hostingHostIdFromInvoiceMetadata(inv);
  if (fromMeta) return fromMeta;
  const own = inv.metadata;
  const sub =
    inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata;
  if (own?.kind || sub?.kind) return null; // some other product
  const subId = invoiceSubscriptionId(inv);
  if (!subId) return null;
  const host = await prisma.host.findFirst({
    where: { stripeSubscriptionId: subId },
    select: { id: true },
  });
  return host?.id ?? null;
}
