"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHostAdmin } from "@/lib/auth";
import { isPricingIntelligenceEnabled } from "@/lib/platform-features";
import { runPricingIntelligenceForHost } from "@/lib/pricing-intelligence/run";

function assertEnabled() {
  if (!isPricingIntelligenceEnabled()) {
    throw new Error(
      "Market pricing intelligence is only available on the hosted Yall Come Back platform.",
    );
  }
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

  try {
    const { runId, recommendationCount } = await runPricingIntelligenceForHost({
      hostId,
      trigger: "MANUAL",
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
