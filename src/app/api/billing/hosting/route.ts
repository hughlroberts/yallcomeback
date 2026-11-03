import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireHostAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageBrand, resolveHostAccessInfo } from "@/lib/host-access";
import { isSameOriginRequest } from "@/lib/logout";
import { redirectToPath } from "@/lib/path-redirect";
import { isStripeConfigured } from "@/lib/stripe";
import {
  HostingBillingError,
  applyBrandedUpgrade,
  billingPortalUrl,
  brandedUpgradeCheckoutUrl,
  hostingSubscriptionUrl,
} from "@/lib/platform-billing";
import {
  SUBSCRIPTION_PATH,
  brandedUpgradeNeedsCheckout,
  canUpgradeToBranded,
  type BillingErrorCode,
} from "@/lib/branded-upgrade";
import { hostProductPath } from "@/lib/hosting";
import { marketplaceSubscriptionUrl } from "@/lib/marketplace-billing";
import { setupServiceCheckoutUrl, setupServiceDone } from "@/lib/setup-service";

export const dynamic = "force-dynamic";

/**
 * Hosting billing buttons (Add card and subscribe, Upgrade to branded
 * website, Manage billing, Buy full setup) post a plain form here.
 *
 * Why not a server action (T39): a server action that redirects to Stripe
 * fails on a page that is older than the last deploy (unknown action id),
 * and any thrown error shows "This page couldn't load". A route handler
 * always answers with a 303: to Stripe, or back to the subscription page
 * with a clear message.
 */
export async function POST(req: NextRequest) {
  const sameOrigin = isSameOriginRequest({
    origin: req.headers.get("origin"),
    secFetchSite: req.headers.get("sec-fetch-site"),
    host: req.headers.get("x-forwarded-host") || req.headers.get("host"),
  });
  if (!sameOrigin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back("failed");
  }
  const intent = String(form.get("intent") || "");
  const requested = String(form.get("hostId") || "").trim() || undefined;

  const access = await requireHostAdmin(requested);
  if (!access) {
    return redirectToPath(
      `/login?callbackUrl=${encodeURIComponent(SUBSCRIPTION_PATH)}`,
      303,
    );
  }
  if (!access.hostId) return back("forbidden");
  const info = resolveHostAccessInfo({
    isPlatform: access.isPlatform,
    hostId: access.hostId,
    hostAccess: access.hostAccess,
  });
  if (!canManageBrand(info) && !access.isPlatform) return back("forbidden");

  const host = await prisma.host.findUnique({
    where: { id: access.hostId },
    include: {
      users: { where: { role: "HOST" }, take: 1 },
      plan: { select: { monthlyPrice: true, slug: true } },
    },
  });
  if (!host) return back("forbidden");

  try {
    if (intent === "upgrade") {
      if (!canUpgradeToBranded(host)) return back("not_marketplace");
      if (!brandedUpgradeNeedsCheckout(host, host.plan)) {
        // Complimentary brand: no charge, so switch now (after the confirm).
        await applyBrandedUpgrade(host.id);
        revalidateBrand(host.slug);
        return redirectToPath(`${SUBSCRIPTION_PATH}?upgraded=website`, 303);
      }
      if (!isStripeConfigured()) return back("stripe_off");
      return toStripe(await brandedUpgradeCheckoutUrl(host));
    }
    if (intent === "subscribe") {
      if (!isStripeConfigured()) return back("stripe_off");
      // T45: Marketplace pays by card too ($12/listing + card processing).
      if (hostProductPath(host) === "marketplace") {
        return toStripe(await marketplaceSubscriptionUrl(host));
      }
      return toStripe(await hostingSubscriptionUrl(host));
    }
    if (intent === "setup") {
      // T45: $500 one-time full setup, any plan, once.
      if (setupServiceDone(host.setupServiceStatus)) return back("setup_paid");
      if (!isStripeConfigured()) return back("stripe_off");
      return toStripe(await setupServiceCheckoutUrl(host));
    }
    if (intent === "portal") {
      if (!isStripeConfigured()) return back("stripe_off");
      return toStripe(await billingPortalUrl(host));
    }
    return back("failed");
  } catch (error) {
    if (error instanceof HostingBillingError) return back(error.code);
    console.error("[billing] hosting checkout failed", intent, error);
    return back("failed");
  }
}

/** GET (refresh / bookmark) goes back to the subscription page. */
export function GET() {
  return redirectToPath(SUBSCRIPTION_PATH, 303);
}

function back(code: BillingErrorCode) {
  return redirectToPath(`${SUBSCRIPTION_PATH}?billingError=${code}`, 303);
}

function toStripe(url: string) {
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function revalidateBrand(slug: string) {
  try {
    revalidatePath("/admin");
    revalidatePath("/admin/brand");
    revalidatePath(SUBSCRIPTION_PATH);
    revalidatePath(`/h/${slug}`);
  } catch {
    // revalidation is best effort
  }
}
