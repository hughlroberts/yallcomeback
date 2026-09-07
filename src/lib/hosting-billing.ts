import { prisma } from "@/lib/db";
import { addMonths, calculateHostingAmount } from "@/lib/hosting";
import {
  hostHasPricingIntelligenceAddon,
  PRICING_INTELLIGENCE_ADDON_LABEL,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import {
  CARD_PROCESSING_LINE,
  getStripe,
  isStripeConfigured,
  processingFeeToNetCents,
  toStripeAmount,
} from "@/lib/stripe";
import {
  customerHasCardOnFile,
  ensurePlatformCustomer,
} from "@/lib/platform-billing";

export async function createHostingInvoiceForHost(opts: {
  hostId: string;
  planId?: string | null;
  notes?: string | null;
  /** If true, try Stripe send_invoice when configured */
  sendStripe?: boolean;
}) {
  const host = await prisma.host.findUnique({
    where: { id: opts.hostId },
    include: { plan: true, users: { where: { role: "HOST" }, take: 1 } },
  });
  if (!host) throw new Error("Host not found");

  const planId = opts.planId || host.planId;
  if (!planId) throw new Error("Assign a hosting plan first");

  const plan = await prisma.hostingPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw new Error("Invalid hosting plan");

  const publishedCount = await prisma.property.count({
    where: { hostId: host.id, published: true },
  });
  const { amount: hostingAmount, propertyCount, unitPrice } =
    calculateHostingAmount(plan, publishedCount);

  // Pricing intelligence is a separate $35/mo line — never folded into plan price
  const addonActive = hostHasPricingIntelligenceAddon(host);
  const addonAmount = addonActive
    ? host.pricingIntelligenceAddonAmount || PRICING_INTELLIGENCE_ADDON_USD
    : 0;
  const amount = hostingAmount + addonAmount;

  const periodStart = host.currentPeriodEnd
    ? new Date(host.currentPeriodEnd)
    : new Date();
  const periodEnd = addMonths(periodStart, 1);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const billingEmail =
    host.billingEmail ||
    host.contactEmail ||
    host.users[0]?.email ||
    null;

  const hostingLine =
    plan.pricingModel === "PER_PROPERTY"
      ? `${plan.name} - ${propertyCount} propert${propertyCount === 1 ? "y" : "ies"} × $${unitPrice}/mo (${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)})`
      : `${plan.name} - website hosting (${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)})`;
  const addonLine = addonActive
    ? ` + ${PRICING_INTELLIGENCE_ADDON_LABEL} $${addonAmount}/mo add-on`
    : "";
  const lineDescription = `${hostingLine}${addonLine}`;

  // Complimentary / $0 plans: keep host as a customer; still charge add-on if active
  if (amount <= 0) {
    const record = await prisma.hostingInvoice.create({
      data: {
        hostId: host.id,
        planId: plan.id,
        amount: 0,
        currency: plan.currency,
        pricingModel: plan.pricingModel,
        unitPrice: 0,
        propertyCount,
        periodStart,
        periodEnd,
        status: "PAID",
        dueDate,
        paidAt: new Date(),
        notes:
          opts.notes ||
          `Complimentary hosting · no charge · ${lineDescription}`,
      },
    });
    await prisma.host.update({
      where: { id: host.id },
      data: {
        planId: plan.id,
        subscriptionStatus: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        billingEmail: billingEmail || host.billingEmail,
      },
    });
    return record;
  }

  let stripeInvoiceId: string | null = null;
  let stripeHostedInvoiceUrl: string | null = null;
  let status: "OPEN" | "DRAFT" | "PAID" = "OPEN";
  let chargedCardOnFile = false;

  const stripe = opts.sendStripe !== false ? getStripe() : null;

  if (stripe && billingEmail) {
    const customerId = await ensurePlatformCustomer({
      id: host.id,
      name: host.name,
      slug: host.slug,
      stripeCustomerId: host.stripeCustomerId,
      contactEmail: host.contactEmail,
      billingEmail: host.billingEmail,
      users: host.users,
    });
    const chargeCard = await customerHasCardOnFile(customerId);

    // Separate Stripe line items so hosting and the $35 add-on stay distinct
    if (hostingAmount > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: toStripeAmount(hostingAmount),
        currency: plan.currency.toLowerCase(),
        description: hostingLine,
      });
    }
    if (addonAmount > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: toStripeAmount(addonAmount),
        currency: plan.currency.toLowerCase(),
        description: `${PRICING_INTELLIGENCE_ADDON_LABEL} — $${addonAmount}/mo add-on (not included in hosting)`,
      });
    }
    const processingCents = processingFeeToNetCents(toStripeAmount(amount));
    if (processingCents > 0) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: processingCents,
        currency: plan.currency.toLowerCase(),
        description: `${CARD_PROCESSING_LINE} — so Yall Come Back nets the listed hosting price`,
      });
    }

    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      metadata: {
        hostId: host.id,
        planId: plan.id,
        kind: "hosting",
        propertyCount: String(propertyCount),
        pricingModel: plan.pricingModel,
        pricingIntelligenceAddon: addonActive ? "1" : "0",
        pricingIntelligenceAddonAmount: String(addonAmount),
      },
      ...(chargeCard
        ? { collection_method: "charge_automatically" as const }
        : { collection_method: "send_invoice" as const, days_until_due: 7 }),
    });

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    if (!chargeCard) {
      try {
        await stripe.invoices.sendInvoice(finalized.id);
      } catch {
        // Test mode / restricted accounts may block send; hosted URL still works
      }
    }

    stripeInvoiceId = finalized.id;
    stripeHostedInvoiceUrl = finalized.hosted_invoice_url ?? null;
    status = finalized.status === "paid" ? "PAID" : "OPEN";
    chargedCardOnFile = chargeCard;
  }

  const record = await prisma.hostingInvoice.create({
    data: {
      hostId: host.id,
      planId: plan.id,
      amount,
      currency: plan.currency,
      pricingModel: plan.pricingModel,
      unitPrice,
      propertyCount,
      periodStart,
      periodEnd,
      status,
      dueDate,
      paidAt: status === "PAID" ? new Date() : undefined,
      stripeInvoiceId,
      stripeHostedInvoiceUrl,
      notes:
        opts.notes ||
        (chargedCardOnFile
          ? `Card on file · ${lineDescription}`
          : stripe
            ? `Stripe invoice sent · ${lineDescription}`
            : isStripeConfigured()
              ? `Stripe customer email missing - manual invoice · ${lineDescription}`
              : `Manual invoice (Stripe not enabled) · ${lineDescription}`),
    },
  });

  await prisma.host.update({
    where: { id: host.id },
    data: {
      planId: plan.id,
      subscriptionStatus:
        status === "PAID" || host.subscriptionStatus === "ACTIVE"
          ? "ACTIVE"
          : "PENDING_PAYMENT",
      billingEmail: billingEmail || host.billingEmail,
    },
  });

  return record;
}

export async function markHostingInvoicePaid(
  invoiceId: string,
  opts?: { stripeInvoiceId?: string }
) {
  const invoice = await prisma.hostingInvoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID") return invoice;

  const paid = await prisma.$transaction(async (tx) => {
    const updated = await tx.hostingInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        ...(opts?.stripeInvoiceId
          ? { stripeInvoiceId: opts.stripeInvoiceId }
          : {}),
      },
    });

    await tx.host.update({
      where: { id: invoice.hostId },
      data: {
        subscriptionStatus: "ACTIVE",
        currentPeriodStart: invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
        active: true,
        hostingPastDueAt: null,
        hostingDunningReminderSentAt: null,
      },
    });

    return updated;
  });

  return paid;
}

export async function markHostingInvoicePaidByStripeId(stripeInvoiceId: string) {
  const invoice = await prisma.hostingInvoice.findFirst({
    where: { stripeInvoiceId },
  });
  if (!invoice) return null;
  return markHostingInvoicePaid(invoice.id, { stripeInvoiceId });
}
