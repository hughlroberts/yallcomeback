import { redirect } from "next/navigation";

/** Nested under Ops → Pricing comps. */
export default function OpsPricingRedirect() {
  redirect("/ops/pricing-comps/intelligence");
}
