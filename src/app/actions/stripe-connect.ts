"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import {
  connectOnboardingErrorMessage,
  connectOriginFromHeaders,
  createConnectOnboardingUrlForHost,
  createDirectChargeCheckout,
  createProductOnConnectedAccount,
} from "@/lib/stripe-connect";
import {
  cancelPlatformHostingSubscription,
  createHostingSubscriptionCheckout,
  createPlatformBillingPortalSession,
  ensurePlatformCustomer,
} from "@/lib/platform-billing";
import { hostProductPath } from "@/lib/hosting";
import { isStripeConfigured, requireStripeClient, toStripeAmount } from "@/lib/stripe";

async function requireBrandHost(formData?: FormData) {
  const requested = formData
    ? String(formData.get("hostId") || "").trim() || undefined
    : undefined;
  const access = await requireHostAdmin(requested);
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
  try {
    assertStripeOn();
    const host = await requireBrandHost();
    const origin = connectOriginFromHeaders(await headers());
    const url = await createConnectOnboardingUrlForHost(host, origin);
    redirect(url);
  } catch (error) {
    const digest =
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof (error as { digest: unknown }).digest === "string"
        ? (error as { digest: string }).digest
        : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;
    redirect(
      `/admin/payments?error=${encodeURIComponent(connectOnboardingErrorMessage(error))}`,
    );
  }
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
  revalidatePath("/account/settings/subscription");
  revalidatePath(`/pay/${host.slug}`);
}

export async function startHostingSubscription(formData?: FormData) {
  assertStripeOn();
  const host = await requireBrandHost(formData);
  if (hostProductPath(host) !== "website") {
    throw new Error(
      "Card checkout is the $25 / month branded website plan. Marketplace-only hosts are billed $12 per listing by invoice.",
    );
  }
  const stripeStatus = (host.stripeSubscriptionStatus || "").toLowerCase();
  const needsFreshCheckout =
    stripeStatus === "paused" ||
    stripeStatus === "canceled" ||
    stripeStatus === "incomplete_expired" ||
    !host.stripeSubscriptionId;
  if (needsFreshCheckout) {
    if (host.stripeSubscriptionId) {
      await cancelPlatformHostingSubscription(host.stripeSubscriptionId);
      await prisma.host.update({
        where: { id: host.id },
        data: {
          stripeSubscriptionId: null,
          stripeSubscriptionStatus: "canceled",
        },
      });
    }
    const fresh = await createHostingSubscriptionCheckout(host);
    if (!fresh.url) throw new Error("Card checkout did not return a URL.");
    redirect(fresh.url);
  }
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

export async function openBillingPortal(formData?: FormData) {
  assertStripeOn();
  const host = await requireBrandHost(formData);
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
  if (!priceId.startsWith("price_")) {
    throw new Error("This extra is not available.");
  }
  const host = await prisma.host.findUnique({ where: { slug: hostSlug } });
  if (!host?.stripeAccountId) {
    throw new Error("This host is not collecting card payments yet.");
  }
  const stripeClient = requireStripeClient();
  const price = await stripeClient.prices.retrieve(
    priceId,
    { expand: ["product"] },
    { stripeAccount: host.stripeAccountId },
  );
  const amountCents = price.unit_amount;
  if (!price.active || amountCents == null || amountCents <= 0) {
    throw new Error("This extra is not available.");
  }
  const product = price.product;
  const productName =
    product &&
    typeof product === "object" &&
    !product.deleted &&
    "name" in product &&
    product.name
      ? product.name
      : "Stay extra";
  const session = await createDirectChargeCheckout({
    accountId: host.stripeAccountId,
    name: productName,
    amountCents,
    successPath: `/pay/${host.slug}/success`,
    cancelPath: `/pay/${host.slug}`,
    metadata: {
      kind: "connected_product",
      hostId: host.id,
      priceId: price.id,
    },
  });
  if (!session.url) throw new Error("Checkout did not return a URL.");
  redirect(session.url);
}
