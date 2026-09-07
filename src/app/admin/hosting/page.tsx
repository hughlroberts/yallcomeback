import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHostAdmin } from "@/lib/auth";
import { Card } from "@/components/ui";

/**
 * Hosts manage listings here; platform billing lives in /ops (ADMIN only).
 * Do not bounce HOST users into ops (they get admin_only).
 */
export default async function AdminHostingPage() {
  const access = await requireHostAdmin();
  if (!access) redirect("/login?callbackUrl=/admin/hosting");

  if (access.isPlatform) {
    redirect("/ops/hosting");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-stone-900">Website hosting</h1>
      <Card className="space-y-3 p-6">
        <p className="text-sm text-stone-600">
          Platform hosting plans, invoices, and approvals are managed by Yall
          Come Back ops. As a host you manage your listings, calendars, and
          bookings from admin.
        </p>
        <p className="text-sm text-stone-600">
          Questions about billing or your plan? Send a message from Admin →
          Messages. Platform email is not live yet.
        </p>
        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/admin/payments" className="text-bonnet hover:underline">
            Card payments &amp; hosting subscription
          </Link>
          <Link href="/admin/properties" className="text-bonnet hover:underline">
            ← Back to properties
          </Link>
        </div>
      </Card>
    </div>
  );
}
