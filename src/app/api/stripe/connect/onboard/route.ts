import { NextResponse } from "next/server";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PRODUCT_ORIGIN } from "@/lib/features";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import { isStripeConfigured } from "@/lib/stripe";
import {
  connectOnboardingErrorMessage,
  createConnectOnboardingUrlForHost,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    PRODUCT_ORIGIN
  );
}

function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, siteOrigin()), 303);
}

function fail(message: string) {
  const url = new URL("/admin/payments", siteOrigin());
  url.searchParams.set("error", message.slice(0, 280));
  return NextResponse.redirect(url, 303);
}

/**
 * Native POST (not a Server Action) so a deploy cannot invalidate the
 * onboard button, and so the browser follows Stripe with a real 303.
 */
async function startOnboarding() {
  if (!isStripeConfigured()) {
    return fail("Card payments are not enabled yet.");
  }

  const access = await requireHostAdmin();
  if (!access) {
    return redirectTo("/login?callbackUrl=/admin/payments");
  }
  if (!access.hostId) {
    return fail("Pick a host brand first.");
  }

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(info) && !access.isPlatform) {
    return fail("You cannot manage payments for this brand.");
  }

  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    include: { users: { where: { role: "HOST" }, take: 1 } },
  });
  if (!host) return fail("Host not found.");

  try {
    const url = await createConnectOnboardingUrlForHost(host);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return fail(connectOnboardingErrorMessage(error));
  }
}

export async function POST() {
  return startOnboarding();
}
