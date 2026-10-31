import { redirect } from "next/navigation";
import { requirePlatformAdminOr404 } from "@/lib/auth";

/** Nested under Ops → Pricing comps. */
export default async function OpsPricingRedirect() {
  // Layout and page render in parallel: 404 non-admins here too, before redirecting.
  await requirePlatformAdminOr404();
  redirect("/ops/pricing-comps/intelligence");
}
