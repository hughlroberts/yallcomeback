"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import {
  createAccountOnboardingLink,
  createConnectedAccountForHost,
  createDirectChargeCheckout,
  createProductOnConnectedAccount,
} from "@/lib/stripe-connect";
import {
  createHostingSubscriptionCheckout,
  createPlatformBillingPortalSession,
  ensurePlatformCustomer,
} from "@/lib/platform-billing";
import { isStripeConfigured, toStripeAmount } from "@/lib/stripe";

async function requireBrandHost() {
  const access = await requireHostAdmin();
  if (!access?.hostId) {
    throw new Error("Pick a host brand first.");
  }
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(info) && !access.isPlatform) {
    throw new Error("You cannot manage payments for this brand.");
  }
  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    include: { users: { where: { role: "HOST" }, take: 1 } },
  });
  if (!host) throw new Error("Host not found");
  return host;
}

function assertStripeOn() {
  if (!isStripeConfigured()) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_ENABLED=true and STRIPE_SECRET_KEY (sk_test_... from the Dashboard).",
    );
  }
}

export async function startConnectOnboarding() {
  assertStripeOn();
  const host = await requireBrandHost();
  let accountId = host.stripeAccountId;
  if (!accountId) {
    accountId = await createConnectedAccountForHost(host);
  }
  const url = await createAccountOnboardingLink(accountId);
  redirect(url);
}

export async function createHostProduct(formData: FormData) {
  assertStripeOn();
  const host = await requireBrandHost();
  const { assertHostAllowsFutureWork } = await import("@/lib/hosting");
  await assertHostAllowsFutureWork(host.id);
  if (!host.stripeAccountId) {
    throw new Error("Onboard to collect payments before creating products.");
  }
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dollars = Number(formData.get("price") || "0");
  if (!name) throw new Error("Product name is required.");
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new Error("Enter a price greater than 0.");
  }
  await createProductOnConnectedAccount({
    accountId: host.stripeAccountId,
    name,
    description,
    priceInCents: toStripeAmount(dollars),
  });
  revalidatePath("/admin/payments");
  revalidatePath(`/pay/${host.slug}`);
}

export async function startHostingSubscription() {
  assertStripeOn();
  const host = await requireBrandHost();
  if (host.subscriptionStatus === "ACTIVE" && host.stripeCustomerId) {
    const portal = await createPlatformBillingPortalSession(
      host.stripeCustomerId,
    );
    if (!portal.url) throw new Error("Billing portal did not return a URL.");
    redirect(portal.url);
  }
  const session = await createHostingSubscriptionCheckout(host);
  if (!session.url) throw new Error("Card checkout did not return a URL.");
  redirect(session.url);
}

export async function openBillingPortal() {
  assertStripeOn();
  const host = await requireBrandHost();
  const customerId = await ensurePlatformCustomer(host);
  const session = await createPlatformBillingPortalSession(customerId);
  if (!session.url) throw new Error("Billing portal did not return a URL.");
  redirect(session.url);
}

/** Guest storefront checkout for a connected-account product. */
export async function buyConnectedProduct(formData: FormData) {
  assertStripeOn();
  const hostSlug = String(formData.get("hostSlug") || "").trim();
  const priceId = String(formData.get("priceId") || "").trim();
  const productName = String(formData.get("productName") || "Stay extra").trim();
  const amountCents = Number(formData.get("amountCents") || "0");
  const host = await prisma.host.findUnique({ where: { slug: hostSlug } });
  if (!host?.stripeAccountId) {
    throw new Error("This host is not collecting card payments yet.");
  }
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("This product has no price.");
  }
  const session = await createDirectChargeCheckout({
    accountId: host.stripeAccountId,
    name: productName,
    amountCents,
    successPath: `/pay/${host.slug}/success`,
    cancelPath: `/pay/${host.slug}`,
    metadata: {
      kind: "connected_product",
      hostId: host.id,
      priceId,
    },
  });
  if (!session.url) throw new Error("Checkout did not return a URL.");
  redirect(session.url);
}
