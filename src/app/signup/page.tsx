import { planPublicDescription } from "@/lib/hosting-prices";
import { PRIMARY_CTA_FOCUS_CLASS } from "@/lib/booking-cta-focus";
import { brandedPriceLabel } from "@/lib/hosting-prices";
import { redirect } from "next/navigation";
import { HostSignupForm } from "@/components/HostSignupForm";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { destAfterHostAuth } from "@/lib/host-signup";

import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Apply to host",
  description:
    "Apply to host on Yall Come Back. List on the marketplace or launch a branded website.",
  path: "/signup",
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; start?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const initialPath =
    params.path === "self" || params.path === "paid" ? params.path : "paid";
  const initialPlan =
    params.plan === "branded" || params.plan === "website"
      ? "website"
      : "marketplace";
  const session = await auth();
  const signedInUser = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, role: true, hostId: true },
      })
    : null;
  if (
    signedInUser &&
    (signedInUser.role === "HOST" || signedInUser.role === "ADMIN") &&
    signedInUser.hostId
  ) {
    redirect(
      await destAfterHostAuth({
        role: signedInUser.role,
        hostId: signedInUser.hostId,
      }),
    );
  }

  const plans = await prisma.hostingPlan.findMany({
    where: { isActive: true, monthlyPrice: { gt: 0 } },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-bonnet">
          Become a host
        </p>
        <h1 className="mt-2 font-display text-4xl font-medium tracking-tight text-stone-900">
          Apply to host on Y&apos;all Come Back
        </h1>
        <p className="mt-4 max-w-md mx-auto text-lg text-stone-600">
          Create your host account. Add your first listing after signup. No
          platform cut of bookings.
        </p>
        <p className="mt-6 text-sm text-stone-500">
          Looking to book a stay?{" "}
          <a
            href="/register"
            className={`font-medium text-bonnet hover:underline ${PRIMARY_CTA_FOCUS_CLASS}`}
          >
            Create a guest account
          </a>
        </p>
      </div>

      <HostSignupForm
        brandedPrice={brandedPriceLabel()}
        initialPath={initialPath}
        initialPlan={initialPlan}
        existingAccount={
          signedInUser?.email
            ? { name: signedInUser.name, email: signedInUser.email }
            : null
        }
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          monthlyPrice: p.monthlyPrice,
          pricingModel: p.pricingModel,
          description: planPublicDescription(p),
          isDefault: p.isDefault,
        }))}
      />
    </div>
  );
}
