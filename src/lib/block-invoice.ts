import { prisma } from "@/lib/db";
import { getStripe, isStripeConfigured, toStripeAmount } from "@/lib/stripe";
import { nightsBetween } from "@/lib/utils";

/**
 * Create + send a Stripe Invoice for a calendar block on the host's
 * connected account (Direct Charge). Stripe's card fee is billed to the
 * host — never to Yall Come Back. Do not fall back to the platform account.
 */
export async function sendStripeInvoiceForBlock(opts: {
  blockId: string;
  amount: number;
  guestEmail: string;
  guestName?: string | null;
  currency?: string;
  /** Extra note on the invoice line */
  description?: string | null;
}) {
  const amount = Math.round(opts.amount * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0.5) {
    throw new Error("Invoice amount must be at least $0.50");
  }

  const email = opts.guestEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Guest email is required for the invoice");
  }

  const stripe = getStripe();
  if (!stripe) {
    throw new Error(
      "Stripe is not enabled. Set STRIPE_ENABLED=true and STRIPE_SECRET_KEY in .env",
    );
  }

  const block = await prisma.calendarBlock.findUnique({
    where: { id: opts.blockId },
    include: {
      property: {
        include: {
          host: {
            select: {
              id: true,
              name: true,
              slug: true,
              stripeAccountId: true,
            },
          },
        },
      },
    },
  });
  if (!block) throw new Error("Calendar block not found");
  if (block.invoiceStatus === "PAID") {
    throw new Error("This stay is already marked paid");
  }
  if (block.stripeInvoiceId && block.invoiceStatus === "OPEN") {
    throw new Error(
      "An open invoice already exists - open the pay link or mark it paid",
    );
  }

  const accountId = block.property.host.stripeAccountId;
  if (!accountId) {
    throw new Error(
      "This host must finish card onboarding before you can send a card invoice. Cash and in-person stays do not need this.",
    );
  }
  const onAccount = { stripeAccount: accountId };

  const currency = (opts.currency || block.invoiceCurrency || "USD").toLowerCase();
  const nights = nightsBetween(block.startDate, block.endDate);
  const checkIn = block.startDate.toISOString().slice(0, 10);
  const checkOut = block.endDate.toISOString().slice(0, 10);
  const guestName =
    opts.guestName?.trim() || block.occupantName?.trim() || email;

  const lineDescription =
    opts.description?.trim() ||
    `${block.property.title} · ${checkIn} → ${checkOut}` +
      (nights > 0 ? ` (${nights} night${nights === 1 ? "" : "s"})` : "");

  const customer = await stripe.customers.create(
    {
      email,
      name: guestName,
      metadata: {
        calendarBlockId: block.id,
        propertyId: block.propertyId,
        hostId: block.property.host.id,
        kind: "calendar_block",
      },
    },
    onAccount,
  );

  await stripe.invoiceItems.create(
    {
      customer: customer.id,
      amount: toStripeAmount(amount),
      currency,
      description: lineDescription,
    },
    onAccount,
  );

  const invoice = await stripe.invoices.create(
    {
      customer: customer.id,
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: true,
      metadata: {
        kind: "calendar_block",
        calendarBlockId: block.id,
        propertyId: block.propertyId,
        hostId: block.property.host.id,
      },
      footer:
        "Pay online with the link above, or pay in person - we can take card on our POS and apply it to this invoice.",
    },
    onAccount,
  );

  if (!invoice.id) throw new Error("Stripe did not return an invoice id");

  const finalized = await stripe.invoices.finalizeInvoice(
    invoice.id,
    undefined,
    onAccount,
  );
  try {
    await stripe.invoices.sendInvoice(finalized.id, undefined, onAccount);
  } catch {
    // Email may fail in test mode; hosted URL still works
  }

  const updated = await prisma.calendarBlock.update({
    where: { id: block.id },
    data: {
      guestEmail: email,
      occupantName: block.occupantName || guestName,
      invoiceAmount: amount,
      invoiceCurrency: currency.toUpperCase(),
      invoiceStatus: "OPEN",
      stripeInvoiceId: finalized.id,
      stripeHostedInvoiceUrl: finalized.hosted_invoice_url ?? null,
      invoiceSentAt: new Date(),
    },
  });

  return updated;
}

export async function markBlockInvoicePaid(
  blockId: string,
  opts?: { stripeInvoiceId?: string },
) {
  const block = await prisma.calendarBlock.findUnique({
    where: { id: blockId },
  });
  if (!block) throw new Error("Calendar block not found");
  if (block.invoiceStatus === "PAID") return block;

  return prisma.calendarBlock.update({
    where: { id: blockId },
    data: {
      invoiceStatus: "PAID",
      invoicePaidAt: new Date(),
      ...(opts?.stripeInvoiceId
        ? { stripeInvoiceId: opts.stripeInvoiceId }
        : {}),
    },
  });
}

export async function markBlockInvoicePaidByStripeId(stripeInvoiceId: string) {
  const block = await prisma.calendarBlock.findFirst({
    where: { stripeInvoiceId },
  });
  if (!block) return null;
  return markBlockInvoicePaid(block.id, { stripeInvoiceId });
}

export function stripeConfiguredLabel() {
  return isStripeConfigured()
    ? "Stripe invoices enabled"
    : "Stripe not configured - enable in .env to email pay links";
}
