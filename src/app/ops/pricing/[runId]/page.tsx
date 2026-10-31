import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";

/** Nested under Ops → Pricing comps. */
export default async function OpsPricingRunRedirect({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  // Layout and page render in parallel: 404 non-admins here too, before redirecting.
  await requirePlatformAdminOr404();
  const { runId } = await params;
  redirect(`/ops/pricing-comps/intelligence/${runId}`);
}
