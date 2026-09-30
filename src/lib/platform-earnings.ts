import { prisma } from "@/lib/db";
import {
  calculateHostingAmount,
  hostProductPath,
  sitePresenceLabel,
} from "@/lib/hosting";
import { syncPlatformInvoicesFromStripe } from "@/lib/hosting-billing";
import { hostHasPricingIntelligenceAddon } from "@/lib/platform-features";

export async function loadOpsEarnings() {
  const sync = await syncPlatformInvoicesFromStripe();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    hosts,
    publishedGroups,
    monthSum,
    paidInvoices,
    lastPaidRows,
    openInvoices,
  ] = await Promise.all([
    prisma.host.findMany({
      where: { hostingMode: "PLATFORM" },
      include: {
        plan: true,
        users: {
          where: { role: "HOST" },
          take: 1,
          select: { email: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.property.groupBy({
      by: ["hostId"],
      where: { published: true },
      _count: { _all: true },
    }),
    prisma.hostingInvoice.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.hostingInvoice.findMany({
      where: { status: "PAID" },
      include: {
        host: { select: { id: true, name: true, slug: true } },
        plan: { select: { name: true, slug: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 40,
    }),
    prisma.hostingInvoice.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      select: { hostId: true, amount: true, paidAt: true },
      take: 500,
    }),
    prisma.hostingInvoice.findMany({
      where: { status: { in: ["OPEN", "FAILED"] } },
      include: {
        host: { select: { id: true, name: true, slug: true } },
        plan: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
  ]);

  const publishedByHost = new Map(
    publishedGroups.map((g) => [g.hostId, g._count._all]),
  );

  const lastPaidByHost = new Map<
    string,
    { amount: number; paidAt: Date | null }
  >();
  for (const row of lastPaidRows) {
    if (!lastPaidByHost.has(row.hostId)) {
      lastPaidByHost.set(row.hostId, {
        amount: row.amount,
        paidAt: row.paidAt,
      });
    }
  }

  const customers = hosts.map((host) => {
    const published = publishedByHost.get(host.id) ?? 0;
    const estimate = host.plan
      ? calculateHostingAmount(host.plan, published)
      : null;
    const addon = hostHasPricingIntelligenceAddon(host)
      ? host.pricingIntelligenceAddonAmount || 35
      : 0;
    const product = hostProductPath(host);
    const complimentary = Boolean(host.plan && host.plan.monthlyPrice <= 0);
    const lastPaid = lastPaidByHost.get(host.id) ?? null;
    return {
      id: host.id,
      name: host.name,
      slug: host.slug,
      email: host.billingEmail || host.contactEmail || host.users[0]?.email || null,
      planName: host.plan?.name || "No plan",
      planSlug: host.plan?.slug || null,
      pricingModel: host.plan?.pricingModel || null,
      product,
      productLabel:
        product === "marketplace"
          ? "Marketplace only"
          : product === "website"
            ? sitePresenceLabel(host.sitePresence)
            : "Self-host",
      complimentary,
      published,
      estimateAmount: estimate ? estimate.amount + addon : addon,
      unitPrice: estimate?.unitPrice ?? 0,
      addon,
      lastPaidAmount: lastPaid?.amount ?? null,
      lastPaidAt: lastPaid?.paidAt ?? null,
      subscriptionStatus: host.subscriptionStatus,
      stripeSubscriptionStatus: host.stripeSubscriptionStatus,
      periodEnd: host.currentPeriodEnd,
      stripeCustomerId: host.stripeCustomerId,
      stripeSubscriptionId: host.stripeSubscriptionId,
    };
  });

  const paying = customers.filter(
    (c) => !c.complimentary && c.subscriptionStatus === "ACTIVE",
  );
  const mrr = paying.reduce((sum, c) => sum + c.estimateAmount, 0);

  return {
    sync,
    collectedThisMonth: monthSum._sum.amount ?? 0,
    paymentsThisMonth: monthSum._count,
    mrr,
    payingCount: paying.length,
    customerCount: customers.filter((c) => !c.complimentary).length,
    customers,
    paidInvoices,
    openInvoices,
  };
}
