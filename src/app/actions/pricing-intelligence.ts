"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin, requirePlatformAdmin } from "@/lib/auth";
import {
  hostHasPricingIntelligenceAddon,
  isPricingIntelligenceEnabled,
  PRICING_INTELLIGENCE_ADDON_USD,
} from "@/lib/platform-features";
import { runPricingIntelligenceForHost } from "@/lib/pricing-intelligence/run";

function assertEnabled() {
  if (!isPricingIntelligenceEnabled()) {
    throw new Error(
      "Market pricing intelligence is only available on the hosted Yall Come Back platform.",
    );
  }
}

/** Host requests the $35/mo add-on (ops activates after payment / review). */
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

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) redirect("/admin/pricing?error=missing");
  if (host.pricingIntelligenceAddonStatus === "ACTIVE") {
    redirect("/admin/pricing?error=already_active");
  }

  await prisma.host.update({
    where: { id: hostId },
    data: {
      pricingIntelligenceAddonStatus: "REQUESTED",
      pricingIntelligenceAddonAmount: PRICING_INTELLIGENCE_ADDON_USD,
      pricingIntelligenceAddonNotes:
        `Host requested $${PRICING_INTELLIGENCE_ADDON_USD}/mo pricing intelligence add-on (not included in hosting).`,
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
    select: { pricingIntelligenceAddonStatus: true },
  });
  if (!host) redirect("/admin/pricing?error=missing");

  const bypass =
    access.isPlatform && formData.get("bypassAddon") === "1";
  if (!bypass && !hostHasPricingIntelligenceAddon(host)) {
    redirect("/admin/pricing?error=addon_required");
  }

  try {
    const { runId, recommendationCount } = await runPricingIntelligenceForHost({
      hostId,
      trigger: "MANUAL",
      bypassAddonCheck: bypass,
    });
    revalidatePath("/admin/pricing");
    redirect(
      `/admin/pricing/${runId}?started=1&n=${recommendationCount}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "run_failed";
    redirect(`/admin/pricing?error=${encodeURIComponent(msg.slice(0, 120))}`);
  }
}

export async function decidePricingRecommendation(formData: FormData) {
  assertEnabled();
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/pricing");

  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || ""); // approve | reject
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

  if (decision === "approve") {
    await prisma.pricingRecommendation.update({
      where: { id },
      data: {
        status: "APPROVED",
        decidedAt: new Date(),
        decidedByUserId: access.session.user.id,
      },
    });
  } else {
    await prisma.pricingRecommendation.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedAt: new Date(),
        decidedByUserId: access.session.user.id,
      },
    });
  }

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
      },
    }),
  ]);

  revalidatePath(`/admin/pricing/${rec.runId}`);
  revalidatePath(`/admin/properties/${rec.propertyId}`);
  revalidatePath("/marketplace");
  redirect(`/admin/pricing/${rec.runId}?applied=1`);
}
