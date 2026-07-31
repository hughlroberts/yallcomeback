"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import {
  createHostingInvoiceForHost,
  markHostingInvoicePaid,
} from "@/lib/hosting-billing";

async function ensurePlatform() {
  const session = await requirePlatformAdmin();
  if (!session) throw new Error("Unauthorized");
  return session;
}

function revalidateHosting(hostSlug?: string) {
  revalidatePath("/ops/hosting");
  revalidatePath("/ops/hosting/plans");
  revalidatePath("/admin");
  revalidatePath("/hosts");
  revalidatePath("/marketplace");
  revalidatePath("/marketplace");
  revalidatePath("/for-hosts");
  if (hostSlug) revalidatePath(`/h/${hostSlug}`);
}

export async function upsertHostingPlan(formData: FormData) {
  await ensurePlatform();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Name required");

  let slug = slugify(String(formData.get("slug") || name));
  const monthlyPrice = Number(formData.get("monthlyPrice") || 0);
  const pricingModelRaw = String(formData.get("pricingModel") || "PER_PROPERTY");
  const pricingModel =
    pricingModelRaw === "FLAT" ? ("FLAT" as const) : ("PER_PROPERTY" as const);
  const minProperties = Math.max(
    1,
    Number(formData.get("minProperties") || 1) || 1
  );
  const description = String(formData.get("description") || "").trim() || null;
  const currency = String(formData.get("currency") || "USD").trim() || "USD";
  const isActive = formData.get("isActive") === "on";
  const isDefault = formData.get("isDefault") === "on";
  const sortOrder = Number(formData.get("sortOrder") || 0);

  if (id) {
    await prisma.hostingPlan.update({
      where: { id },
      data: {
        name,
        slug,
        monthlyPrice,
        pricingModel,
        minProperties,
        description,
        currency,
        isActive,
        isDefault,
        sortOrder,
      },
    });
    if (isDefault) {
      await prisma.hostingPlan.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }
  } else {
    const existing = await prisma.hostingPlan.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;
    const plan = await prisma.hostingPlan.create({
      data: {
        name,
        slug,
        monthlyPrice,
        pricingModel,
        minProperties,
        description,
        currency,
        isActive,
        isDefault,
        sortOrder,
      },
    });
    if (isDefault) {
      await prisma.hostingPlan.updateMany({
        where: { id: { not: plan.id } },
        data: { isDefault: false },
      });
    }
  }

  revalidateHosting();
}

export async function deleteHostingPlan(formData: FormData) {
  await ensurePlatform();
  const id = String(formData.get("id") || "");
  const inUse = await prisma.host.count({ where: { planId: id } });
  if (inUse > 0) throw new Error("Plan is assigned to hosts - deactivate instead");
  await prisma.hostingPlan.delete({ where: { id } });
  revalidateHosting();
}

export async function approveHost(formData: FormData) {
  await ensurePlatform();
  const hostId = String(formData.get("hostId") || "");
  const planId = String(formData.get("planId") || "").trim() || null;
  const approvalNotes =
    String(formData.get("approvalNotes") || "").trim() || null;
  const issueInvoice = formData.get("issueInvoice") === "on";
  const hostingMode = String(formData.get("hostingMode") || "PLATFORM") as
    | "PLATFORM"
    | "SELF";

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) throw new Error("Host not found");

  if (hostingMode === "SELF") {
    await prisma.host.update({
      where: { id: hostId },
      data: {
        hostingMode: "SELF",
        // Free self-host → always on free marketplace; brand lives on their domain
        listOnMarketplace: true,
        sitePresence: "CUSTOM",
        approvalStatus: "APPROVED",
        approvalNotes,
        reviewedAt: new Date(),
        planId: null,
        subscriptionStatus: "NONE",
        active: true,
      },
    });
    await prisma.property.updateMany({
      where: { hostId },
      data: { listOnMarketplace: true },
    });
    revalidateHosting(host.slug);
    return;
  }

  if (!planId) throw new Error("Select a hosting plan for platform-hosted sites");

  await prisma.host.update({
    where: { id: hostId },
    data: {
      hostingMode: "PLATFORM",
      approvalStatus: "APPROVED",
      approvalNotes,
      reviewedAt: new Date(),
      planId,
      subscriptionStatus: issueInvoice ? "PENDING_PAYMENT" : "PENDING_PAYMENT",
      active: true,
    },
  });

  if (issueInvoice) {
    await createHostingInvoiceForHost({
      hostId,
      planId,
      notes: "First invoice after approval",
    });
  }

  revalidateHosting(host.slug);
}

export async function rejectHost(formData: FormData) {
  await ensurePlatform();
  const hostId = String(formData.get("hostId") || "");
  const approvalNotes =
    String(formData.get("approvalNotes") || "").trim() || null;

  const host = await prisma.host.update({
    where: { id: hostId },
    data: {
      approvalStatus: "REJECTED",
      approvalNotes,
      reviewedAt: new Date(),
      active: false,
      subscriptionStatus: "CANCELLED",
    },
  });

  revalidateHosting(host.slug);
}

export async function suspendHost(formData: FormData) {
  await ensurePlatform();
  const hostId = String(formData.get("hostId") || "");
  const approvalNotes =
    String(formData.get("approvalNotes") || "").trim() || null;

  const host = await prisma.host.update({
    where: { id: hostId },
    data: {
      approvalStatus: "SUSPENDED",
      approvalNotes,
      reviewedAt: new Date(),
      active: false,
      subscriptionStatus: "CANCELLED",
    },
  });

  revalidateHosting(host.slug);
}

export async function issueHostingInvoice(formData: FormData) {
  await ensurePlatform();
  const hostId = String(formData.get("hostId") || "");
  const planId = String(formData.get("planId") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) throw new Error("Host not found");
  if (host.approvalStatus !== "APPROVED") {
    throw new Error("Host must be approved before invoicing");
  }
  if (host.hostingMode !== "PLATFORM") {
    throw new Error("Self-hosted hosts do not pay platform hosting");
  }

  await createHostingInvoiceForHost({ hostId, planId, notes });
  revalidateHosting(host.slug);
}

export async function markHostingInvoicePaidAction(formData: FormData) {
  await ensurePlatform();
  const invoiceId = String(formData.get("invoiceId") || "");
  const invoice = await markHostingInvoicePaid(invoiceId);
  const host = await prisma.host.findUnique({ where: { id: invoice.hostId } });
  revalidateHosting(host?.slug);
}

export async function voidHostingInvoice(formData: FormData) {
  await ensurePlatform();
  const invoiceId = String(formData.get("invoiceId") || "");
  const invoice = await prisma.hostingInvoice.update({
    where: { id: invoiceId },
    data: { status: "VOID" },
    include: { host: true },
  });
  revalidateHosting(invoice.host.slug);
}

export async function assignHostPlan(formData: FormData) {
  await ensurePlatform();
  const hostId = String(formData.get("hostId") || "");
  const planId = String(formData.get("planId") || "").trim() || null;
  const host = await prisma.host.update({
    where: { id: hostId },
    data: { planId },
  });
  revalidateHosting(host.slug);
}

/**
 * Platform ops: edit an existing host brand (plan, billing, domain, marketplace).
 * Complimentary plan = free forever for your own brand / partners; still PLATFORM
 * so multi-listing businesses stay on your stack without per-property charges.
 */
export async function updateHostOps(formData: FormData) {
  await ensurePlatform();
  const hostId = String(formData.get("hostId") || "");
  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) throw new Error("Host not found");

  const planId = String(formData.get("planId") || "").trim() || null;
  const hostingMode = String(formData.get("hostingMode") || host.hostingMode) as
    | "PLATFORM"
    | "SELF";
  const subscriptionStatus = String(
    formData.get("subscriptionStatus") || host.subscriptionStatus,
  ) as
    | "NONE"
    | "PENDING_PAYMENT"
    | "ACTIVE"
    | "PAST_DUE"
    | "CANCELLED";
  const sitePresence = String(
    formData.get("sitePresence") || host.sitePresence,
  ) as "STAYLOCAL" | "CUSTOM" | "BOTH";
  const websiteUrl =
    String(formData.get("websiteUrl") || "").trim() || null;
  const billingEmail =
    String(formData.get("billingEmail") || "").trim() || null;
  const contactEmail =
    String(formData.get("contactEmail") || "").trim() || null;
  const approvalNotes =
    String(formData.get("approvalNotes") || "").trim() || null;
  const listOnMarketplace = formData.get("listOnMarketplace") === "on";
  const active = formData.get("active") === "on";
  const name = String(formData.get("name") || host.name).trim() || host.name;
  const tagline = String(formData.get("tagline") || "").trim() || null;

  let planMonthly = 0;
  if (planId) {
    const plan = await prisma.hostingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Plan not found");
    planMonthly = plan.monthlyPrice;
  }

  // Complimentary / $0: active and never billed
  const isComplimentary =
    planId &&
    planMonthly <= 0 &&
    hostingMode === "PLATFORM";

  const data: {
    name: string;
    tagline: string | null;
    planId: string | null;
    hostingMode: "PLATFORM" | "SELF";
    subscriptionStatus:
      | "NONE"
      | "PENDING_PAYMENT"
      | "ACTIVE"
      | "PAST_DUE"
      | "CANCELLED";
    sitePresence: "STAYLOCAL" | "CUSTOM" | "BOTH";
    websiteUrl: string | null;
    billingEmail: string | null;
    contactEmail: string | null;
    approvalNotes: string | null;
    listOnMarketplace: boolean;
    active: boolean;
    approvalStatus?: "APPROVED" | "SUSPENDED";
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
  } = {
    name,
    tagline,
    planId,
    hostingMode,
    subscriptionStatus: isComplimentary ? "ACTIVE" : subscriptionStatus,
    sitePresence:
      hostingMode === "SELF" ? "CUSTOM" : sitePresence,
    websiteUrl,
    billingEmail,
    contactEmail,
    approvalNotes,
    listOnMarketplace:
      hostingMode === "SELF" ? true : listOnMarketplace,
    active,
  };

  if (isComplimentary) {
    data.approvalStatus = "APPROVED";
    data.active = true;
    if (!host.currentPeriodStart) {
      data.currentPeriodStart = new Date();
      const end = new Date();
      end.setFullYear(end.getFullYear() + 10);
      data.currentPeriodEnd = end;
    }
  }

  if (hostingMode === "SELF") {
    data.planId = null;
    data.subscriptionStatus = "NONE";
  }

  await prisma.host.update({
    where: { id: hostId },
    data,
  });

  revalidateHosting(host.slug);
  revalidatePath(`/ops/hosting/${hostId}`);
}
