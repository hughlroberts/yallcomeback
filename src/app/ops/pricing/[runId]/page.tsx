import { redirect } from "next/navigation";

/** Nested under Ops → Pricing comps. */
export default async function OpsPricingRunRedirect({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  redirect(`/ops/pricing-comps/intelligence/${runId}`);
}
