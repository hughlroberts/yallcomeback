import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";

/** Nested under Ops → Pricing comps. Hosts stay in admin. */
export default async function AdminPricingRunRedirect({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin");

  if (access.isPlatform) {
    const { runId } = await params;
    redirect(`/ops/pricing-comps/intelligence/${runId}`);
  }

  redirect("/admin");
}
