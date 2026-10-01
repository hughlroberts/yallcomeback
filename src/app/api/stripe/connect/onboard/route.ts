import { NextResponse } from "next/server";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import { isStripeConfigured } from "@/lib/stripe";
import {
  connectOnboardingErrorMessage,
  connectOriginFromHeaders,
  createConnectOnboardingUrlForHost,
  isTrustedConnectRequest,
} from "@/lib/stripe-connect";

export const dynamic = "force-dynamic";

function redirectTo(path: string, origin: string) {
  return NextResponse.redirect(new URL(path, origin), 303);
}

function fail(message: string, origin: string) {
  const url = new URL("/admin/payments", origin);
  url.searchParams.set("error", message.slice(0, 280));
  return NextResponse.redirect(url, 303);
}

/**
 * Native POST (not a Server Action) so a deploy cannot invalidate the
 * onboard button, and so the browser follows Stripe with a real 303.
 */
async function startOnboarding(req: Request) {
  const origin = connectOriginFromHeaders(req.headers);
  if (!isStripeConfigured()) {
    return fail("Card payments are not enabled yet.", origin);
  }

  const access = await requireHostAdmin();
  if (!access) {
    return redirectTo("/login?callbackUrl=/admin/payments", origin);
  }
  if (!access.hostId) {
    return fail("Pick a host brand first.", origin);
  }

  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(info) && !access.isPlatform) {
    return fail("You cannot manage payments for this brand.", origin);
  }

  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    include: { users: { where: { role: "HOST" }, take: 1 } },
  });
  if (!host) return fail("Host not found.", origin);

  try {
    const url = await createConnectOnboardingUrlForHost(host, origin);
    return NextResponse.redirect(url, 303);
  } catch (error) {
    return fail(connectOnboardingErrorMessage(error), origin);
  }
}

export async function POST(req: Request) {
  if (!isTrustedConnectRequest(req.headers)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return startOnboarding(req);
}
