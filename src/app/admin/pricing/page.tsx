import { redirect } from "next/navigation";

/** Pricing intelligence lives under Ops → Pricing comps. */
export default function AdminPricingRedirect() {
  redirect("/ops/pricing-comps/intelligence");
}
