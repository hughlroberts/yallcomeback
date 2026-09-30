import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";

/**
 * Pricing intelligence lives under Ops. Do not bounce HOST users into /ops.
 */
export default async function AdminPricingRedirect() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin");

  if (access.isPlatform) {
    redirect("/ops/pricing-comps/intelligence");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">
        Pricing intelligence
      </h1>
      <Card className="space-y-3 p-6">
        <p className="text-sm text-stone-600">
          Market pricing research is run by Yall Come Back ops. It is not in
          Host admin yet. You still set rates on each listing.
        </p>
        <Link
          href="/admin/properties"
          className="text-sm font-semibold text-bonnet hover:underline"
        >
          Properties
        </Link>
      </Card>
    </div>
  );
}
