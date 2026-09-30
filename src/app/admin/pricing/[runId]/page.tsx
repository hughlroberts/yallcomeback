import { redirect } from "next/navigation";

/** Pricing intelligence lives under Ops → Pricing comps. */
export default async function AdminPricingRunRedirect({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  redirect(`/ops/pricing-comps/intelligence/${runId}`);
}
