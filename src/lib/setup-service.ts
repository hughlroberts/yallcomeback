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

/** Already invoiced by hand: pay that invoice, not a second card charge. */
export function setupServiceInvoiced(status: string | null | undefined): boolean {
  return status === "INVOICED";
}

/** Why card checkout for setup is refused, or null when it may start. */
export function setupCheckoutBlock(
  status: string | null | undefined,
): "setup_paid" | "setup_invoiced" | null {
  if (setupServiceDone(status)) return "setup_paid";
  if (setupServiceInvoiced(status)) return "setup_invoiced";
  return null;
}

type SetupCheckoutHost = PlatformHost & {
  setupServiceStatus: string;
  setupServiceOpenSessionId?: string | null;
};

type OpenSessionCheck =
  | { kind: "reuse"; url: string }
  | { kind: "paid" }
  | { kind: "none" };

/**
 * T46: look at the brand's stored setup session. Open and still the right
 * amount → reuse it (two tabs land on the same page, so only one payment).
 * Open but stale → expire it in Stripe. Paid → record it, no new checkout.
 */
async function checkStoredSetupSession(
  stripe: ReturnType<typeof requireStripeClient>,
  hostId: string,
  sessionId: string | null | undefined,
  expectedCents: number,
): Promise<OpenSessionCheck> {
  if (!sessionId || !sessionId.startsWith("cs_")) return { kind: "none" };
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return { kind: "none" };
  }
  if (session.payment_status === "paid") {
    await recordSetupServicePayment(session, hostId);
    return { kind: "paid" };
  }
  if (session.status === "open") {
    if (session.url && session.amount_total === expectedCents) {
      return { kind: "reuse", url: session.url };
    }
    await expireSetupSession(stripe, sessionId);
  }
  return { kind: "none" };
}

async function expireSetupSession(
  stripe: ReturnType<typeof requireStripeClient>,
  sessionId: string,
): Promise<void> {
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch (err) {
    // Already expired / completed: nothing to do.
    console.warn("[setup-service] expire failed", sessionId, err);
  }
}

export async function setupServiceCheckoutUrl(host: SetupCheckoutHost): Promise<string> {
  const block = setupCheckoutBlock(host.setupServiceStatus);
  if (block) throw new HostingBillingError(block);
  const stripe = requireStripeClient();
  const { netCents, feeCents } = setupServiceCents();
  const totalCents = netCents + feeCents;

  const stored = await checkStoredSetupSession(
    stripe,
    host.id,
    host.setupServiceOpenSessionId,
    totalCents,
  );
  if (stored.kind === "reuse") return stored.url;
  if (stored.kind === "paid") throw new HostingBillingError("setup_paid");

  const customerId = await ensurePlatformCustomer(host);
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

  // Store it only if nobody else stored one meanwhile (two clicks at once).
  const claim = await prisma.host.updateMany({
    where: {
      id: host.id,
      setupServiceOpenSessionId: host.setupServiceOpenSessionId ?? null,
      setupServiceStatus: { notIn: ["PAID", "WAIVED", "INVOICED"] },
    },
    data: { setupServiceOpenSessionId: session.id },
  });
  if (claim.count > 0) return session.url;

  // Lost the race (or status changed): drop ours, use the winner's.
  await expireSetupSession(stripe, session.id);
  const fresh = await prisma.host.findUnique({
    where: { id: host.id },
    select: { setupServiceStatus: true, setupServiceOpenSessionId: true },
  });
  const freshBlock = setupCheckoutBlock(fresh?.setupServiceStatus);
  if (freshBlock) throw new HostingBillingError(freshBlock);
  const winner = await checkStoredSetupSession(
    stripe,
    host.id,
    fresh?.setupServiceOpenSessionId,
    totalCents,
  );
  if (winner.kind === "reuse") return winner.url;
  if (winner.kind === "paid") throw new HostingBillingError("setup_paid");
  throw new HostingBillingError("failed", "setup checkout race");
}

type SetupSessionLike = {
  id: string;
  metadata?: Record<string, string | undefined> | null;
  payment_status?: string | null;
  amount_total?: number | null;
  customer?: string | { id?: string } | null;
  payment_intent?: string | { id?: string } | null;
};

export type SetupRecordResult = "recorded" | "already" | "duplicate" | "ignored";

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2002";
}

/**
 * Record a paid setup session. Idempotent per session (unique row), so the
 * success page and the webhook can both call it.
 * - "recorded": first paid session → brand marked PAID, admin emailed once.
 * - "already": this session was seen before (replay / second caller).
 * - "duplicate": a SECOND paid session for a brand already paid/waived →
 *   kept, flagged, admin alerted. Never refunded automatically.
 * - "ignored": not a paid setup session for this brand.
 */
export async function recordSetupServicePayment(
  session: SetupSessionLike,
  expectedHostId?: string | null,
): Promise<SetupRecordResult> {
  if (session.metadata?.kind !== SETUP_SERVICE_KIND) return "ignored";
  const hostId = session.metadata?.hostId || "";
  if (!hostId) return "ignored";
  if (expectedHostId && expectedHostId !== hostId) return "ignored";
  if (session.payment_status !== "paid") return "ignored";

  const before = await prisma.host.findUnique({
    where: { id: hostId },
    select: { setupServiceStatus: true, setupServiceCheckoutSessionId: true },
  });
  if (!before) return "ignored";
  // Paid before T46 added the payment rows: same session = already recorded.
  if (before.setupServiceCheckoutSessionId === session.id) return "already";

  try {
    await prisma.setupServicePayment.create({
      data: {
        hostId,
        sessionId: session.id,
        paymentIntentId: stripeObjectId(session.payment_intent),
        amountCents: session.amount_total ?? null,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "already";
    throw err;
  }

  const paidAt = new Date();
  const claim = await prisma.host.updateMany({
    where: { id: hostId, setupServiceStatus: { notIn: ["PAID", "WAIVED"] } },
    data: {
      setupServiceStatus: "PAID",
      setupServicePaidAt: paidAt,
      setupServiceAmount: SETUP_SERVICE_USD,
      setupServiceCheckoutSessionId: session.id,
      setupServiceOpenSessionId: null,
    },
  });
  if (claim.count > 0) {
    await notifyAdminsOfSetupPurchase(hostId, session, {
      wasInvoiced: before.setupServiceStatus === "INVOICED",
    }).catch((err) => {
      console.error("[setup-service] admin email failed", hostId, err);
    });
    return "recorded";
  }

  // Second payment slipped through: keep it, flag it, tell the admin.
  await prisma.setupServicePayment.update({
    where: { sessionId: session.id },
    data: { duplicate: true },
  });
  await alertDuplicateSetupPayment(hostId, session, before.setupServiceStatus).catch(
    (err) => {
      console.error("[setup-service] duplicate alert failed", hostId, err);
    },
  );
  return "duplicate";
}

/** Success page: read the session from Stripe, then record it. */
export async function applySetupServiceSession(
  sessionId: string,
  expectedHostId?: string | null,
): Promise<SetupRecordResult> {
  if (!sessionId.startsWith("cs_")) return "ignored";
  const stripe = requireStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return recordSetupServicePayment(session, expectedHostId);
}

type SetupEmailFacts = {
  hostName: string;
  slug: string;
  hostId: string;
  contact: string | null;
  totalUsd: string;
  sessionId: string;
  customerId: string | null;
};

function factLines(opts: SetupEmailFacts): string[] {
  return [
    `Brand: ${opts.hostName} (${opts.slug})`,
    `Brand id: ${opts.hostId}`,
    `Contact: ${opts.contact || "none on file"}`,
    `Paid: ${opts.totalUsd} (setup + card processing)`,
    `Checkout: ${opts.sessionId}`,
    ...(opts.customerId ? [`Customer: ${opts.customerId}`] : []),
  ];
}

export function setupPurchaseEmailText(
  opts: SetupEmailFacts & { wasInvoiced?: boolean },
): string {
  return [
    `${opts.hostName} bought Full setup.`,
    "",
    ...factLines(opts),
    "",
    ...(opts.wasInvoiced
      ? [
          "This brand was also marked as invoiced for setup. Void that invoice so it is not paid twice.",
          "",
        ]
      : []),
    "The host sees: Setup purchased, we'll contact you.",
    "Next: contact the host to start setup.",
  ].join("\n");
}

export function duplicateSetupEmailText(
  opts: SetupEmailFacts & { previousStatus: string },
): string {
  return [
    `${opts.hostName} paid for Full setup a second time.`,
    "",
    ...factLines(opts),
    `Setup status before this payment: ${opts.previousStatus}`,
    "",
    "This payment was recorded and flagged as a duplicate. Nothing was refunded automatically.",
    "Next: check the payment in the Stripe dashboard and refund it by hand if it is a mistake.",
  ].join("\n");
}

async function setupEmailContext(hostId: string, session: SetupSessionLike) {
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
  if (!host) return null;
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
  const totalUsd =
    session.amount_total != null
      ? `$${(session.amount_total / 100).toFixed(2)}`
      : `$${SETUP_SERVICE_USD.toFixed(2)}+`;
  const facts: SetupEmailFacts = {
    hostName: host.name,
    slug: host.slug,
    hostId: host.id,
    contact,
    totalUsd,
    sessionId: session.id,
    customerId: stripeObjectId(session.customer),
  };
  return { facts, recipients, contact };
}

async function sendToAdmins(
  recipients: string[],
  subject: string,
  text: string,
  replyTo: string | null,
) {
  for (const to of recipients) {
    if (!(await canSendEmailTo(to))) continue;
    await dispatchPlatformEmail({ to, subject, text, replyTo }).catch(() => null);
  }
}

/** Email the platform alert inbox once per brand purchase (claimed). */
async function notifyAdminsOfSetupPurchase(
  hostId: string,
  session: SetupSessionLike,
  opts: { wasInvoiced?: boolean } = {},
) {
  const claim = await prisma.host.updateMany({
    where: { id: hostId, setupServiceAdminNotifiedAt: null },
    data: { setupServiceAdminNotifiedAt: new Date() },
  });
  if (claim.count === 0) return;
  const ctx = await setupEmailContext(hostId, session);
  if (!ctx) return;
  await sendToAdmins(
    ctx.recipients,
    `Full setup purchased: ${ctx.facts.hostName}`,
    setupPurchaseEmailText({ ...ctx.facts, wasInvoiced: opts.wasInvoiced }),
    ctx.contact,
  );
}

/** Once per duplicate session (claimed on the payment row). */
async function alertDuplicateSetupPayment(
  hostId: string,
  session: SetupSessionLike,
  previousStatus: string,
) {
  const claim = await prisma.setupServicePayment.updateMany({
    where: { sessionId: session.id, adminAlertedAt: null },
    data: { adminAlertedAt: new Date() },
  });
  if (claim.count === 0) return;
  const ctx = await setupEmailContext(hostId, session);
  if (!ctx) return;
  await sendToAdmins(
    ctx.recipients,
    `Second Full setup payment: ${ctx.facts.hostName}`,
    duplicateSetupEmailText({ ...ctx.facts, previousStatus }),
    ctx.contact,
  );
}
