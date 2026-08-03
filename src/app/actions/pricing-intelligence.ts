"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin, requirePlatformAdmin } from "@/lib/auth";
import {
  hostHasPricingIntelligenceAddon,
  isPricingIntelligenceEnabled,
  PRICING_INTELLIGENCE_ADDON_LABEL,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import {
  executePricingPipeline,
  runPricingIntelligenceForHost,
} from "@/lib/pricing-intelligence/run";
import { getStripe, isStripeConfigured, toStripeAmount } from "@/lib/stripe";
import { after } from "next/server";

function assertEnabled() {
  if (!isPricingIntelligenceEnabled()) {
    throw new Error(
      "Market pricing intelligence is only available on the hosted Yall Come Back platform.",
    );
  }
}

/**
 * Host starts $35/mo add-on: Stripe Checkout when configured, else REQUESTED
 * for ops to activate after manual payment.
 */
export async function requestPricingIntelligenceAddon(formData: FormData) {
  assertEnabled();
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const hostId = access.isPlatform
    ? String(formData.get("hostId") || access.hostId || "")
    : access.hostId || "";
  if (!hostId) redirect("/admin/pricing?error=host");
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect("/admin/pricing?error=forbidden");
  }

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    include: { users: { where: { role: "HOST" }, take: 1 } },
  });
  if (!host) redirect("/admin/pricing?error=missing");
  if (!host.pricingIntelligenceEnabled && !access.isPlatform) {
    redirect("/admin/pricing?error=access_off");
  }
  if (host.pricingIntelligenceAddonStatus === "ACTIVE") {
    redirect("/admin/pricing?error=already_active");
  }

  const amount = host.pricingIntelligenceAddonAmount || PRICING_INTELLIGENCE_ADDON_USD;
  const email =
    host.billingEmail ||
    host.contactEmail ||
    host.users[0]?.email ||
    access.session.user.email ||
    null;

  // Prefer Stripe subscription Checkout when keys are live
  const stripe = getStripe();
  if (stripe && isStripeConfigured() && email) {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      (process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : "http://localhost:3000");

    let customerId = host.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: host.name,
        metadata: { hostId: host.id, slug: host.slug },
      });
      customerId = customer.id;
      await prisma.host.update({
        where: { id: host.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: host.id,
      success_url: `${origin}/admin/pricing?checkout=success`,
      cancel_url: `${origin}/admin/pricing?checkout=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: toStripeAmount(amount),
            recurring: { interval: "month" },
            product_data: {
              name: PRICING_INTELLIGENCE_ADDON_LABEL,
              description:
                "Monthly market pricing research add-on — not included in website hosting.",
            },
          },
        },
      ],
      metadata: {
        kind: "pricing_intelligence_addon",
        hostId: host.id,
      },
      subscription_data: {
        metadata: {
          kind: "pricing_intelligence_addon",
          hostId: host.id,
        },
      },
    });

    await prisma.host.update({
      where: { id: host.id },
      data: {
        pricingIntelligenceAddonStatus: "REQUESTED",
        pricingIntelligenceAddonAmount: amount,
        pricingIntelligenceAddonNotes: `Stripe Checkout started ${new Date().toISOString().slice(0, 10)} · session ${session.id}`,
      },
    });

    if (session.url) redirect(session.url);
  }

  // Manual path (Stripe off): ops activates after payment
  await prisma.host.update({
    where: { id: hostId },
    data: {
      pricingIntelligenceAddonStatus: "REQUESTED",
      pricingIntelligenceAddonAmount: amount,
      pricingIntelligenceAddonNotes: `Host requested $${amount}/mo pricing intelligence add-on (not included in hosting). Stripe not configured — activate in ops after payment.`,
    },
  });

  revalidatePath("/admin/pricing");
  revalidatePath(`/ops/hosting/${hostId}`);
  redirect("/admin/pricing?requested=1");
}

/** Host cancels the add-on at period end (immediate cancel for v1). */
export async function cancelPricingIntelligenceAddon(formData: FormData) {
  assertEnabled();
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const hostId = access.isPlatform
    ? String(formData.get("hostId") || access.hostId || "")
    : access.hostId || "";
  if (!hostId) redirect("/admin/pricing?error=host");
  if (!access.isPlatform && access.hostId !== hostId) {
    redirect("/admin/pricing?error=forbidden");
  }

  await prisma.host.update({
    where: { id: hostId },
    data: {
      pricingIntelligenceAddonStatus: "CANCELLED",
      pricingIntelligenceAddonNotes: `Cancelled by host ${new Date().toISOString().slice(0, 10)}`,
    },
  });

  revalidatePath("/admin/pricing");
  revalidatePath(`/ops/hosting/${hostId}`);
  redirect("/admin/pricing?cancelled=1");
}

/**
 * Platform ops: set add-on status (ACTIVE after payment, PAST_DUE, etc.).
 * Never folds into core hosting plan amount — separate subscription line.
 */
export async function setPricingIntelligenceAddonStatus(formData: FormData) {
  assertEnabled();
  const session = await requirePlatformAdmin();
  if (!session) redirect("/login?callbackUrl=/ops/hosting");

  const hostId = String(formData.get("hostId") || "");
  const status = String(formData.get("status") || "NONE");
  const allowed = ["NONE", "REQUESTED", "ACTIVE", "PAST_DUE", "CANCELLED"];
  if (!hostId || !allowed.includes(status)) {
    redirect(`/ops/hosting/${hostId || ""}?error=addon`);
  }

  await prisma.host.update({
    where: { id: hostId },
    data: {
      pricingIntelligenceAddonStatus: status as
        | "NONE"
        | "REQUESTED"
        | "ACTIVE"
        | "PAST_DUE"
        | "CANCELLED",
      pricingIntelligenceAddonAmount: PRICING_INTELLIGENCE_ADDON_USD,
      ...(status === "ACTIVE"
        ? {
            pricingIntelligenceAddonStartedAt: new Date(),
            pricingIntelligenceAddonNotes: `Activated by ops · $${PRICING_INTELLIGENCE_ADDON_USD}/mo add-on (separate from hosting)`,
          }
        : {}),
    },
  });

  revalidatePath(`/ops/hosting/${hostId}`);
  revalidatePath("/admin/pricing");
  redirect(`/ops/hosting/${hostId}?addon=1`);
}

export async function startPricingResearch(formData: FormData) {
  assertEnabled();
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const hostId = access.isPlatform
    ? String(formData.get("hostId") || access.hostId || "")
    : access.hostId || "";
  if (!hostId) redirect("/admin/pricing?error=host");

  if (!access.isPlatform && access.hostId !== hostId) {
    redirect("/admin/pricing?error=forbidden");
  }

  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: {
      pricingIntelligenceEnabled: true,
      pricingIntelligenceAddonStatus: true,
    },
  });
  if (!host) redirect("/admin/pricing?error=missing");

  // Platform admin may force a run for testing (you) without paid status
  const bypass =
    access.isPlatform && formData.get("bypassAddon") === "1";
  if (!bypass) {
    if (!host.pricingIntelligenceEnabled) {
      redirect("/admin/pricing?error=access_off");
    }
    if (!hostHasPricingIntelligenceAddon(host)) {
      redirect("/admin/pricing?error=addon_required");
    }
  }

  try {
    // Create RUNNING row immediately, then execute full multi-agent pipeline
    // in the background so the UI can show live step progress (~30–90s with LLM).
    const { runId } = await runPricingIntelligenceForHost({
      hostId,
      trigger: "MANUAL",
      bypassAddonCheck: bypass,
      deferExecution: true,
    });

    const periodEnd = new Date();
    const periodStart = new Date(
      periodEnd.getTime() - 90 * 24 * 60 * 60 * 1000,
    );

    after(async () => {
      try {
        await executePricingPipeline(runId, {
          hostId,
          periodStart,
          periodEnd,
        });
        revalidatePath("/admin/pricing");
        revalidatePath(`/admin/pricing/${runId}`);
      } catch (err) {
        console.error("[pricing-intelligence] pipeline failed", err);
      }
    });

    revalidatePath("/admin/pricing");
    revalidatePath(`/admin/pricing/${runId}`);
    // redirect() throws NEXT_REDIRECT — must not be caught below
    redirect(`/admin/pricing/${runId}?running=1`);
  } catch (e) {
    // Next.js redirect() and notFound() use thrown digests — rethrow them
    if (
      typeof e === "object" &&
      e !== null &&
      "digest" in e &&
      typeof (e as { digest?: unknown }).digest === "string" &&
      String((e as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "run_failed";
    redirect(`/admin/pricing?error=${encodeURIComponent(msg.slice(0, 160))}`);
  }
}

function parseFeedbackFromForm(formData: FormData): {
  feedbackNotes: string | null;
  feedbackTags: string;
  feedbackAt: Date;
} {
  const notes = String(formData.get("feedbackNotes") || "").trim() || null;
  const tags = formData
    .getAll("feedbackTag")
    .map((t) => String(t).trim())
    .filter(Boolean);
  return {
    feedbackNotes: notes,
    feedbackTags: JSON.stringify(tags),
    feedbackAt: new Date(),
  };
}

export async function decidePricingRecommendation(formData: FormData) {
  assertEnabled();
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || ""); // approve | reject
  const feedback = parseFeedbackFromForm(formData);
  const rec = await prisma.pricingRecommendation.findUnique({
    where: { id },
    include: {
      run: { select: { hostId: true } },
      property: { select: { hostId: true, title: true } },
    },
  });
  if (!rec) redirect("/admin/pricing?error=missing");
  if (
    !access.isPlatform &&
    access.hostId !== rec.run.hostId
  ) {
    redirect("/admin/pricing?error=forbidden");
  }
  if (rec.status !== "PENDING") {
    redirect(`/admin/pricing/${rec.runId}?error=already_decided`);
  }

  await prisma.pricingRecommendation.update({
    where: { id },
    data: {
      status: decision === "approve" ? "APPROVED" : "REJECTED",
      decidedAt: new Date(),
      decidedByUserId: access.session.user.id,
      ...feedback,
    },
  });

  revalidatePath(`/admin/pricing/${rec.runId}`);
  revalidatePath("/admin/pricing");
  redirect(`/admin/pricing/${rec.runId}?decided=1`);
}

/**
 * Apply an approved recommendation to baseNightlyRate (human-gated executor).
 */
export async function applyPricingRecommendation(formData: FormData) {
  assertEnabled();
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const id = String(formData.get("id") || "");
  const rec = await prisma.pricingRecommendation.findUnique({
    where: { id },
    include: {
      run: { select: { hostId: true } },
      property: { select: { id: true, hostId: true, title: true } },
    },
  });
  if (!rec) redirect("/admin/pricing?error=missing");
  if (!access.isPlatform && access.hostId !== rec.run.hostId) {
    redirect("/admin/pricing?error=forbidden");
  }
  if (rec.status !== "APPROVED") {
    redirect(`/admin/pricing/${rec.runId}?error=not_approved`);
  }

  const feedback = parseFeedbackFromForm(formData);

  await prisma.$transaction([
    prisma.property.update({
      where: { id: rec.propertyId },
      data: { baseNightlyRate: rec.suggestedNightlyRate },
    }),
    prisma.pricingRecommendation.update({
      where: { id },
      data: {
        status: "APPLIED",
        appliedAt: new Date(),
        decidedByUserId: access.session.user.id,
        // Keep earlier decision feedback; append apply notes if provided
        ...(feedback.feedbackNotes || feedback.feedbackTags !== "[]"
          ? {
              feedbackNotes: [rec.feedbackNotes, feedback.feedbackNotes]
                .filter(Boolean)
                .join(" · ") || feedback.feedbackNotes,
              feedbackTags:
                feedback.feedbackTags !== "[]"
                  ? feedback.feedbackTags
                  : rec.feedbackTags,
              feedbackAt: feedback.feedbackAt,
            }
          : {}),
      },
    }),
  ]);

  revalidatePath(`/admin/pricing/${rec.runId}`);
  revalidatePath(`/admin/properties/${rec.propertyId}`);
  revalidatePath("/marketplace");
  redirect(`/admin/pricing/${rec.runId}?applied=1`);
}
