/**
 * T45 — $500 one-time full setup add-on, paid by card (Checkout mode
 * "payment"). Any host can buy it once, any time (also after an upgrade).
 *
 * After Stripe confirms payment (success page or checkout.session.completed,
 * both idempotent): record the purchase on the host, email the platform
 * alert inbox once, and the host sees "Setup purchased, we'll contact you".
 */
import { prisma } from "@/lib/db";
import { canonicalSiteOrigin } from "@/lib/features";
import { SETUP_SERVICE_LABEL } from "@/lib/hosting";
import { SETUP_SERVICE_USD } from "@/lib/hosting-prices";
import { SUBSCRIPTION_PATH } from "@/lib/branded-upgrade";
import { CARD_PROCESSING_LINE, processingFeeToNetCents } from "@/lib/card-processing";
import { requireStripeClient } from "@/lib/stripe";
import { dispatchPlatformEmail } from "@/lib/messaging";
import { canSendEmailTo } from "@/lib/notification-prefs";
import { platformAlertRecipients } from "@/lib/domain-setup";
import {
  HostingBillingError,
  ensurePlatformCustomer,
  stripeObjectId,
  type PlatformHost,
} from "@/lib/platform-billing";

export const SETUP_SERVICE_KIND = "setup_service";
export const SETUP_ANCHOR = "setup";

/** Setup already bought (or waived by Platform admin): no second charge. */
export function setupServiceDone(status: string | null | undefined): boolean {
  return status === "PAID" || status === "WAIVED";
}

export function setupServiceCents(): { netCents: number; feeCents: number } {
  const netCents = Math.round(SETUP_SERVICE_USD * 100);
  return { netCents, feeCents: processingFeeToNetCents(netCents) };
}

export async function setupServiceCheckoutUrl(
  host: PlatformHost & { setupServiceStatus: string },
): Promise<string> {
  if (setupServiceDone(host.setupServiceStatus)) {
    throw new HostingBillingError("setup_paid");
  }
  const stripe = requireStripeClient();
  const customerId = await ensurePlatformCustomer(host);
  const { netCents, feeCents } = setupServiceCents();
  const metadata = { kind: SETUP_SERVICE_KIND, hostId: host.id };
  const origin = canonicalSiteOrigin();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    payment_method_types: ["card"],
    billing_address_collection: "auto",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: netCents,
          product_data: { name: SETUP_SERVICE_LABEL },
        },
      },
      ...(feeCents > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: feeCents,
                product_data: { name: CARD_PROCESSING_LINE },
              },
            },
          ]
        : []),
    ],
    success_url: `${origin}${SUBSCRIPTION_PATH}?setup=paid&session_id={CHECKOUT_SESSION_ID}#${SETUP_ANCHOR}`,
    cancel_url: `${origin}${SUBSCRIPTION_PATH}?setup=canceled#${SETUP_ANCHOR}`,
    metadata,
    payment_intent_data: { metadata },
  });
  if (!session.url) throw new HostingBillingError("failed", "no checkout url");
  return session.url;
}

type SetupSessionLike = {
  id: string;
  metadata?: Record<string, string | undefined> | null;
  payment_status?: string | null;
  amount_total?: number | null;
  customer?: string | { id?: string } | null;
};

/**
 * Record a paid setup session (idempotent: the first caller claims it).
 * Returns "recorded" the first time, "already" after, "ignored" otherwise.
 */
export async function recordSetupServicePayment(
  session: SetupSessionLike,
  expectedHostId?: string | null,
): Promise<"recorded" | "already" | "ignored"> {
  if (session.metadata?.kind !== SETUP_SERVICE_KIND) return "ignored";
  const hostId = session.metadata?.hostId || "";
  if (!hostId) return "ignored";
  if (expectedHostId && expectedHostId !== hostId) return "ignored";
  if (session.payment_status !== "paid") return "ignored";

  const paidAt = new Date();
  const amountUsd = SETUP_SERVICE_USD;
  const claim = await prisma.host.updateMany({
    where: { id: hostId, setupServiceStatus: { not: "PAID" } },
    data: {
      setupServiceStatus: "PAID",
      setupServicePaidAt: paidAt,
      setupServiceAmount: amountUsd,
      setupServiceCheckoutSessionId: session.id,
    },
  });
  const claimed = claim.count > 0;
  await notifyAdminsOfSetupPurchase(hostId, session).catch((err) => {
    console.error("[setup-service] admin email failed", hostId, err);
  });
  return claimed ? "recorded" : "already";
}

/** Success page: read the session from Stripe, then record it. */
export async function applySetupServiceSession(
  sessionId: string,
  expectedHostId?: string | null,
): Promise<"recorded" | "already" | "ignored"> {
  if (!sessionId.startsWith("cs_")) return "ignored";
  const stripe = requireStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return recordSetupServicePayment(session, expectedHostId);
}

export function setupPurchaseEmailText(opts: {
  hostName: string;
  slug: string;
  hostId: string;
  contact: string | null;
  totalUsd: string;
  sessionId: string;
  customerId: string | null;
}): string {
  return [
    `${opts.hostName} bought Full setup.`,
    "",
    `Brand: ${opts.hostName} (${opts.slug})`,
    `Brand id: ${opts.hostId}`,
    `Contact: ${opts.contact || "none on file"}`,
    `Paid: ${opts.totalUsd} (setup + card processing)`,
    `Checkout: ${opts.sessionId}`,
    ...(opts.customerId ? [`Customer: ${opts.customerId}`] : []),
    "",
    "The host sees: Setup purchased, we'll contact you.",
    "Next: contact the host to start setup.",
  ].join("\n");
}

/** Email the platform alert inbox once per brand purchase (claimed). */
async function notifyAdminsOfSetupPurchase(hostId: string, session: SetupSessionLike) {
  const claim = await prisma.host.updateMany({
    where: { id: hostId, setupServiceAdminNotifiedAt: null },
    data: { setupServiceAdminNotifiedAt: new Date() },
  });
  if (claim.count === 0) return;
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: {
      id: true,
      name: true,
      slug: true,
      contactEmail: true,
      billingEmail: true,
      users: { where: { role: "HOST" }, take: 1, select: { email: true } },
    },
  });
  if (!host) return;
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", emailNotifications: true, email: { contains: "@" } },
    select: { email: true, hostId: true },
  });
  const preferred = admins.filter((u) => !u.hostId);
  const list = preferred.length > 0 ? preferred : admins;
  const recipients = platformAlertRecipients(
    list.map((u) => u.email!),
    process.env.PLATFORM_ALERT_EMAIL,
  );
  const contact =
    host.contactEmail || host.billingEmail || host.users[0]?.email || null;
  const total =
    session.amount_total != null
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : `$${SETUP_SERVICE_USD.toFixed(2)}+`;
  const text = setupPurchaseEmailText({
    hostName: host.name,
    slug: host.slug,
    hostId: host.id,
    contact,
    totalUsd: total,
    sessionId: session.id,
    customerId: stripeObjectId(session.customer),
  });
  for (const to of recipients) {
    if (!(await canSendEmailTo(to))) continue;
    await dispatchPlatformEmail({
      to,
      subject: `Full setup purchased: ${host.name}`,
      text,
      replyTo: contact,
    }).catch(() => null);
  }
}
